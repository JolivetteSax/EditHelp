var homophones = [
  'your','youre',
  'their','theyre','there',
  'its',
  'one','won',
  'affect','effect',
  'then','than',
  'weather','whether',
  'here','hear',
  'bear','bare',
  'complement','compliment',
  'allowed', 'aloud',
  'capital', 'capital',
  'principle', 'principal',
];
function onOpen(e) {
  DocumentApp.getUi().createAddonMenu()
      .addItem('Start', 'showSidebar')
      .addToUi();
}

/**
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 *
 * @param {object} e The event parameter for a simple onInstall trigger. To
 *     determine which authorization mode (ScriptApp.AuthMode) the trigger is
 *     running in, inspect e.authMode. (In practice, onInstall triggers always
 *     run in AuthMode.FULL, but onOpen triggers may be AuthMode.LIMITED or
 *     AuthMode.NONE.)
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * This method is only used by the regular add-on, and is never called by
 * the mobile add-on version.
 */
function showSidebar() {
  var ui = HtmlService.createHtmlOutputFromFile('sidebar')
      .setTitle('Translate');
  DocumentApp.getUi().showSidebar(ui);
}

function runDocumentTextHighlighter() {
  var body = DocumentApp.getActiveDocument().getBody();
  var paragraphs = body.getParagraphs();
  
  paragraphs.forEach(function(paragraph) {
    
    var pText = paragraph.editAsText();
    var pString = pText.getText();
    var word = "";
    var wordList = [];
    var wordStart = 0;
    var freq = {};
    for(var i=0;i< pString.length;i++){
      var char = pString[i];
      if(char.match("[A-Za-z'’‘]")){
        if(char.match("[A-Za-z]")){
          word = word + char;
        }
        if(wordStart == 0){
          wordStart = i;
        }
      }
      else{
        if(word != ""){
          word = word.toLowerCase();
          var tagged = false;
          if(homophones.indexOf(word) >= 0){
            var highlightStyle = {};
            highlightStyle[DocumentApp.Attribute.BACKGROUND_COLOR] = '#ffff00';
            pText.setAttributes(wordStart, i-1, highlightStyle);
            tagged = true;
          }
          else{
            if(word.length > 4){
              var count = 0;
              if(word in freq){
                count = freq[word]
              }
              count++;
              freq[word] = count;
            }
          }
          wordList.push({text: word, start: wordStart, end: i-1, phone: tagged});
          word = "";
          wordStart = 0;
        }
      }      
    }
    for (var j=0;j<wordList.length;j++){
      var word = wordList[j];
      if(!word['phone']){
        if(freq[word.text] == 2){
            var highlightStyle = {};
            highlightStyle[DocumentApp.Attribute.BACKGROUND_COLOR] = '#ffe4c4';
            pText.setAttributes(word.start, word.end, highlightStyle);
        }
      }
    }
    
  });
}

/**
 * Gets the text the user has selected. If there is no selection,
 * this function displays an error message.
 *
 * @return {Array.<string>} The selected text.
 */
function getSelectedText() {
  var selection = DocumentApp.getActiveDocument().getSelection();
  if (selection) {
    var text = [];
    var elements = selection.getSelectedElements();
    for (var i = 0; i < elements.length; ++i) {
      if (elements[i].isPartial()) {
        var element = elements[i].getElement().asText();
        var startIndex = elements[i].getStartOffset();
        var endIndex = elements[i].getEndOffsetInclusive();

        text.push(element.getText().substring(startIndex, endIndex + 1));
      } else {
        var element = elements[i].getElement();
        // Only translate elements that can be edited as text; skip images and
        // other non-text elements.
        if (element.editAsText) {
          var elementText = element.asText().getText();
          // This check is necessary to exclude images, which return a blank
          // text element.
          if (elementText) {
            text.push(elementText);
          }
        }
      }
    }
    if (!text.length) {
      throw 'Please select some text.';
    }
    return text;
  } else {
    throw 'Please select some text.';
  }
}



/**

 *
 * @param {string} origin The two-letter short form for the origin language.
 * @param {string} dest The two-letter short form for the destination language.
 * @param {boolean} savePrefs Whether to save the origin and destination
 *     language preferences.
 * @return {Object} Object containing the original text and the result of the
 *     translation.
 */
function runText(savePrefs) {
  if (savePrefs) {
    PropertiesService.getUserProperties()
        .setProperty('originLang', origin)
        .setProperty('destLang', dest);
  }
  var text = getSelectedText().join('\n');
  return {
    text: text,
    zipfWords: ['foo', 'bar']
  };
}

/**
 * Replaces the text of the current selection with the provided text, or
 * inserts text at the current cursor location. (There will always be either
 * a selection or a cursor.) If multiple elements are selected, only inserts the
 * translated text in the first element that can contain text and removes the
 * other elements.
 *
 * @param {string} newText The text with which to replace the current selection.
 */
function insertText(newText) {
  var selection = DocumentApp.getActiveDocument().getSelection();
  if (selection) {
    var replaced = false;
    var elements = selection.getSelectedElements();
    if (elements.length === 1 && elements[0].getElement().getType() ===
        DocumentApp.ElementType.INLINE_IMAGE) {
      throw "Can't insert text into an image.";
    }
    for (var i = 0; i < elements.length; ++i) {
      if (elements[i].isPartial()) {
        var element = elements[i].getElement().asText();
        var startIndex = elements[i].getStartOffset();
        var endIndex = elements[i].getEndOffsetInclusive();
        element.deleteText(startIndex, endIndex);
        if (!replaced) {
          element.insertText(startIndex, newText);
          replaced = true;
        } 
        else {
          // This block handles a selection that ends with a partial element. We
          // want to copy this partial text to the previous element so we don't
          // have a line-break before the last partial.
          var parent = element.getParent();
          var remainingText = element.getText().substring(endIndex + 1);
          parent.getPreviousSibling().asText().appendText(remainingText);
          // We cannot remove the last paragraph of a doc. If this is the case,
          // just remove the text within the last paragraph instead.
          if (parent.getNextSibling()) {
            parent.removeFromParent();
          } else {
            element.removeFromParent();
          }
        }
      } else {
        var element = elements[i].getElement();
        if (!replaced && element.editAsText) {
          // Only translate elements that can be edited as text, removing other
          // elements.
          element.clear();
          element.asText().setText(newText);
          replaced = true;
        } else {
          // We cannot remove the last paragraph of a doc. If this is the case,
          // just clear the element.
          if (element.getNextSibling()) {
            element.removeFromParent();
          } else {
            element.clear();
          }
        }
      }
    }
  } else {
    var cursor = DocumentApp.getActiveDocument().getCursor();
    var surroundingText = cursor.getSurroundingText().getText();
    var surroundingTextOffset = cursor.getSurroundingTextOffset();

    // If the cursor follows or preceds a non-space character, insert a space
    // between the character and the translation. Otherwise, just insert the
    // translation.
    if (surroundingTextOffset > 0) {
      if (surroundingText.charAt(surroundingTextOffset - 1) != ' ') {
        newText = ' ' + newText;
      }
    }
    if (surroundingTextOffset < surroundingText.length) {
      if (surroundingText.charAt(surroundingTextOffset) != ' ') {
        newText += ' ';
      }
    }
    cursor.insertText(newText);
  }
}


/*
function translateText(text, origin, dest) {
  if (origin === dest) return text;
  return LanguageApp.translate(text, origin, dest);
}
*/
