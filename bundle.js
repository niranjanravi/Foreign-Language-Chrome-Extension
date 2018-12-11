(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
//const spacyNLP = require("spacy-nlp");
const vader = require('vader-sentiment');
var node_ner = require('node-ner');

var ner = new node_ner({
  install_path : 'stanford-ner-2014-10-26/stanford-ner-2014-10-26'
});

var nlp = require('compromise');


var myName = 'karrie-test';

var nativeLang; //array with native languages
var fbId;
var fbIds = {};
var fbId2;
var analyzedFbId = new Set();
var language1; // language of post
var language2; // language of link contents
var linkText;
var translatedText; // updates when switching to link section
var wikiText = "";
var pageLang;

// variables for use in entity analysis - global because want it to be preserved
// between user content analysis and link content analysis
var matchedWords = []; // array of matched text items in English
var matchedWordsLower = [];
var selectedEntities = []; // array of entities that corresponds with matchedWords
var selectedEntityTypes = []; // array of entity types corresponding with selectedEntities
var hasEntity;

var translatedTextOrig; // store unhighlighted translation of original user content
var translatedTextFull;
var originalFull;

// activity logging variables
var allEntities = [];
var uniqueEntities = [];
var emotionLog;
var sentimentLog;
var postId;

/* Generates random 5-character id.
 * For logging post identification.
 */
function generateId() {
  var id = "";
  var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < 5; i++) {
    id += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return id;
}

/* Return closest parent element of given class. */
function getFbId(elt) {
    var id = elt.find("._5pcq")[0]["href"];
    id = id.match(/\d{15}/g).slice(-1)[0];
    return id;
}

// Add text from Wikipedia to the "Keyword Analysis" box
function addWikiText(extract, trans) {
  if (extract.indexOf("\n") >= 0 && extract.substring(0, extract.indexOf("\n")).length > 40) {
    extract = extract.substring(0, extract.indexOf("\n"));
  }
  if (extract.lastIndexOf("</p>") && extract.substring(0, extract.lastIndexOf("</p>")).length > 40) {
    extract = extract.substring(0, extract.lastIndexOf("</p>") + 4);
  }
  if (trans) {
    $.get(translateUrl + extract, function(data) {
      extract = data.data.translations[0].translatedText;
      wikiText += extract + "</span></div>";
      wikiText += "<p style='color:#888888;'>Translated from " + pageLang + ".wikipedia.org</p></span></div>";
    });
  } else {
    wikiText += extract + "</span></div>";
  }
}

$(document).ready(function() {

  // get array of native languages from storage
  chrome.storage.sync.get("nativelangs", function(obj){
    if (obj.nativelangs != null) {
      nativeLang = obj.nativelangs;
    }
  });

  $('._3t54').unbind().bind("DOMSubtreeModified", function() {
    var fbIdClick = getFbId($(event.target).closest("._5pcr"));
    if (analyzedFbId.has(fbIdClick)) {
      var logBlob = {
        time: Date.now() - 18000000,
        postID: fbIdClick.substring(5),
        like: 1
      };
      var payLoad = {
        name: myName,
        logBlob: logBlob
      };
      chrome.runtime.sendMessage(payLoad, function(response){});
    }
  });

  $('#contentArea').on('DOMNodeRemoved', function(e) {
    var removed = $($(e.target).children()[0]);
    if (removed.is('._1mf._1mj')) {
      if (removed[0].innerText != '\n') {
        var fbIdComment = getFbId($(e.target).closest("._5pcr"));
        if (analyzedFbId.has(fbIdComment)) {
          var logBlob = {
            time: Date.now() - 18000000,
            postID: fbIdComment.substring(5),
            comment: 1
          };
          var payLoad = {
            name: myName,
            logBlob: logBlob
          };
          chrome.runtime.sendMessage(payLoad, function(response){});
        }
      }
    }
  });

  $(document).on("mouseover", "._1w_m", function() {
    var position = $(this).offset();
    var width = $(this).width();
    var height = $(this).height();
    var linkText = $(this).find(".3x-2").text();

    var includeText = 0;
    var includeImage = 0; // 1 if mtm div has height and width
    var includeLink = 0;
    var includeShared = 0;

    var autoTranslated = $(this).find(".userContent").find("._5wpt").find("p").text();
    //If Facebook autotranslates the post, then retrieve hidden original content
    if(autoTranslated.length > 0){
      var main = $(this).find(".hidden_elem").find("p").text();

    }else{
      var main = $(this).find(".userContent").find("p").text();
    };

    if(main){//if text exists
      includeText = 1;
    }
    if ($(this).find("._5s6c").text()) { //if title and content exists
      linkText = $(this).find("._5s6c").text() + "<br><br>" + $(this).find("._3bt9").text();
      includeLink = 1;
    }
    if (linkText) {
      //if post is a shared post
      if ($(this).find("._2zpv").text()) {
        if (main) {
          main += '<hr>' + $(this).find("._2zpv").text();
        } else {
          main = $(this).find("._2zpv").text();
        }
        includeShared = 1;
      }
      //if the link is a movie
      if ($(this).find("._53j5").text()) {
        linkText = "";
      }
      //if the post is a commented on post and the whole .3x-2 class contains the comments as well
      if ($(this).find("._1w_m").text()) {
        linkText = "";
      }
      //if the link is a bunch of pictures
      if ($(this).find("._2a2q").text()) {
        linkText = "";
      }
      //if link is a location
      if ($(this).find("._2ph_").text()) {
        linkText = "";
      }
    }
    //text on shared video post
    if ($(this).find("._2zpv").text()) {
      linkText = $(this).find("._2zpv").text();
    }

    if ($(this).find(".mtm")) {
      if ($(this).find(".mtm").css('width') != undefined && $(this).find(".mtm").css('height') != undefined) {
        includeImage = 1;
      }
    }

    main = main.replace(/See Translation/i, "");
    linkText = linkText.replace(/See Translation/i, "");

    function addHoverBox() {
      $("body").append("<div id='hover-box' style='margin:10px; border-right:8px solid #3B5998; position:absolute; width:auto; height:auto;'></div>");
      $("#hover-box").css("left", position.left + width + 2 + "px");
      $("#hover-box").css("top", position.top + "px");
      $("#hover-box").css("width", "8px");
      $("#hover-box").css("height", height + "px");
    }

    function createButton() {
      $("body").append("<button class='btn-class' style='position:absolute;border-radius:5px;'>Analyze</button>");
      $(".btn-class").css("left", (position.left + width + 20) + "px");
      $(".btn-class").css("top", (position.top + 5) + "px");
      $(".btn-class").css("background-color", "#3B5998");
      $(".btn-class").css("color", "white");
      $(".btn-class").css("position", "absolute");
      $(".btn-class").css("border", "none");
      $(".btn-class").css("padding", "10px");
      $(".btn-class").css("font-weight", "bold");
      $(".btn-class").css("z-index", "301");
    }

    function addTranslationBox() {
      console.log("Adding translation box");
      $("body").append("<div id='translation-box' style='background-color:#1A99DB; position:absolute; height:auto;'></div>");
      $("#translation-box").css("left", (position.left + width + 28) + "px");
      $("#translation-box").css("top", position.top + 25 + "px");
      $("#translation-box").css("padding", "5px 15px 10px 15px");
      $("#translation-box").css("z-index", "300");
      $("#translation-box").css("border-radius", "5px");
      var boxPos = $("#translation-box").offset();
      $("#translation-box").css("width", Math.round($(window).width() - boxPos.left - 40) + "px");
      $("#translation-box").css("min-width", "250px");
      $("#translation-box").css("max-width", "300px");
    }

    function getPostDiv(){
      var link = $("._5pcq[href*='"+ fbId +"']")[0];
      return link.offsetParent.offsetParent;
    }



    /* Grabs translation and remove special patterns. Calls runEntity Analysis with
     * original content language code if it is supported by TextRazor. Otherwise, runs
     * entity analysis with English.
     */
    function translateText(content, language, linkSection) {
      // remove hashtags, insert periods
      // remove every special character, add space after the !

      var i = 0; // index to search after
      while (content.indexOf("#") >= 0) {
        tagIndex = content.indexOf("#");
        nextSpace = content.indexOf(" ", tagIndex);
        if (nextSpace >= 0) {
          content = content.substring(0, nextSpace) + "." + content.substring(nextSpace);
        }
        content = content.substring(0, tagIndex) + content.substring(tagIndex + 1);
      }
      content = content.replace(/See Translation/i, "");
      content = content.replace(/See More/i, "");
      content = content.replace(/&quot;/g, '"');
      content = content.replace(/&/g, ' ');
      var translateButton = getTranslationButton();

      console.log(content);
      
      // Clicks the translation button to read the post
      if(containsTranslationButton()){
          translateButton.click();
          addHoverBox();
          createButton();
          addTranslationBox();
      }

      // Waits 1 second because it takes a while to click the translation button
      setTimeout(function(){
          var postParent = getPostDiv();
          var translationDiv = $("._5wpt ._50f4 div", postParent)[0];
          var translatedText = translationDiv.textContent;

          translatedText = translatedText.replace(/See Translation/i, "");
          translatedText = translatedText.replace(/See More/i, "");

          console.log("After translation: " + translatedText);

          const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(translatedText);
          console.log("Intensity of Translation: " + intensity.compound);

          translatedTextOrig = translatedText; // store translation of original user content
          translatedTextFull = translatedText;
          $("#translation-box").html("<div id='translationToggle'><h2 style='color:white; margin-bottom:4px; margin-top:15px; background-color: #3b5998; border-radius: 4px; text-align:center; padding:2px;'> Translation </h2></div><div id=\'white-box\'></div><br>");
          $("#white-box").css('overflow-y', 'auto');
          $("#white-box").css('align-items', 'stretch');
          $("#white-box").css('max-height', '200px');
          $("#white-box").css('background-color', 'white');
          $("#white-box").css('height', 'auto');
          $("#white-box").css('padding', '10px');
          $("#white-box").css('width', 'calc(100% - 20px)');
          $("#white-box").css('word-wrap', 'break-word');
          $("#white-box").css('display', 'inline-block');
          $("#white-box").text(translatedText);

          runEntityAnalysis(translatedText, "eng");

          runEmotionAnalysis(translatedText);
      }, 1000);
    }

    function clickButton(content) {
      $(".btn-class").on("click", function() {
        $("#translation-box").remove();
        analyzedFbId.add(fbId);
        postId = fbId;

        uniqueEntities = [];
        if(!containsTranslationButton()){
          addTranslationBox();
        }
        translateText(main, language1, false);
      });
    }

    var parent; // represents the HTML element that is the parent of this post
    // returns true if there is a "See Translation" button for this post
    function containsTranslationButton(){
      var origLink =  $('a._5pcq[href*="' + fbId +'"]')[0];
      parent = origLink.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
      var links = $("._43f9._63qh", parent);
      return links.length > 0;
    }

    function getTranslationButton(){
      if(containsTranslationButton()){
        return $("._43f9._63qh a", parent)[0];
      }
    }

    function detectLanguage(content) {
      var isNative = false; //if language is native
      if (!(fbId in fbIds)) {
        console.log("FB ID: " + fbId);
        if(containsTranslationButton()){
          console.log("Translation button exists!");
          // unable to determine what language it is without calling an API
          // for now, we just know it's not English, so we create the hover box
          fbIds[fbId] = "n/a";
          // addHoverBox();
          // createButton();
          clickButton(content);
        }
      } else {
        console.log("Already visited this post");
        addHoverBox();
        createButton();
        clickButton(content);
      }
    }

    /* Log close box. */
    $(document).off('click').on('click', function(e) {
      // if click target is not container nor descendant of container
      var container = $("#translation-box");
      var analyzeButton = $(".btn-class");
      var hover = $("#hover-box");
      if (document.getElementById("translation-box") != null && !container.is(e.target)
        && container.has(e.target).length === 0 && !analyzeButton.is(e.target)) {
        var logBlob = {
          time: Date.now() - 18000000,
          postID: postId.substring(5),
          closeBox: 1
        };
        var payLoad = {
          name: myName,
          logBlob: logBlob
        };
        chrome.runtime.sendMessage(payLoad, function(response){});

        container.remove();
        analyzeButton.remove();
        hover.remove();
      }
    });

    /* Runs entity analysis using language langCode, replaces entity text with highlighted clickable
     * entity object. Individual entity analyses are displayed in box when highlighted text is clicked.
     * When linkSection is true, content is from the link and not user content.
     */
    function runEntityAnalysis(content, langCode, linkSection) {
      // Discoveres entities through the Compromise NLP package
      var compromiseEntities = nlp(content).topics().out('offsets');
      console.log('Entities found through compromise library:', compromiseEntities.map(x=>x.text));

      if (!linkSection) {
        $("#translation-box").append("<div id='eToggleContainer'><div id='entityToggle'><h2 id='entity-label' style='color: white; margin-bottom: 4px;background-color: #3b5998; border-radius: 4px; text-align:center; padding:2px;'> Keyword Analysis </h2></div><div id='kQuestion' style='color:gray; display:inline-block'>?</div></div><div id=\'eInfo\'></div>");

        $("#eToggleContainer").css('margin-top', '2px');
        $("#eToggleContainer").css('margin-bottom', '4px');

        $("#entityToggle").css('display', 'inline-block');
        $("#entityToggle").css('width', '92%');

        $("#kQuestion").css('color', 'white');
        $("#kQuestion").css('background-color', '#3b5998');
        $("#kQuestion").css('border-radius', '4px');
        $("#kQuestion").css('padding-top', '2.5px');
        $("#kQuestion").css('padding-bottom', '2.5px');
        $("#kQuestion").css('width', '7%');
        $("#kQuestion").css('text-align', 'center');
        $("#kQuestion").css('cursor', 'pointer');
        $("#kQuestion").css('display', 'inline-block');
        $("#kQuestion").css('float', 'right');

        $("#eInfo").html("<p style='text-align:left'> Keyword Analysis extracts and identifies the name of people, places, and products whose meanings might still be unclear after translation using the <a href='https://en.wikipedia.org/wiki/Named-entity_recognition'>Entity Extraction algorithm</a>. After extracting the words from the posts, the result provides a description of those words (category, blurb from Wikipedia, and Wikipedia Link).</p>");
        $("#eInfo").css('background-color', '#d7d9dc');
        $("#eInfo").css('height', 'auto');
        $("#eInfo").css('width', 'auto');
        $("#eInfo").css('text-align', 'center');
        $("#eInfo").css('padding', '10px');
        $("#eInfo").css('display', 'inline-block');
        $("#eInfo").css('width', 'calc(100% - 20px)');
        $("#eInfo").css('margin-bottom', '4px');
        $("#eInfo").hide(); //hide question box unless question button is clicked

        $("#kQuestion").click(function() { //slide question box down when button is clicked
          $("#eInfo").slideToggle();
        });            

        $("#translation-box").append("<div id='white-box2'>");
        $("#white-box2").css('background-color', 'white');
        $("#white-box2").css('height', 'auto');
        $("#white-box2").css('padding', '10px');
        $("#white-box2").css('width', 'auto');
        $("#white-box2").css('text-align', 'center');

        $("#white-box2").css('display', 'inline-block');
        $("#white-box2").css('width', 'calc(100% - 20px)');
        var cleanText = "";
        if (linkSection) {
          cleanText = translatedTextOrig + "<hr><p><b>Link:</b></p>" + translatedText;
        } else {
          cleanText = translatedText;
        }
        $("#white-box").append(cleanText);
      }

      for (var i = 0; i < compromiseEntities.length; i++) {
        var entity = compromiseEntities[i].text.trim();
        var highlighted = "<a href='#'><mark class='entity'" +
         "style='background-color: #ffb3b3; opacity: .75;'>" + entity + "</mark></a>";
        content = content.replace(entity, highlighted);
      }

      $("#white-box2").empty();
      if(compromiseEntities.length == 0){
        $("#white-box2").html("<p style='text-align:left'>No keywords found.</p>");
      } else {
        $("#white-box2").html("<p style='text-align:left'>Click a highlighted keyword to learn more.</p>");
      }

      $("#white-box").empty();
      $("#white-box").append(content);

      // Displays Wikipedia descriptions for each entity
      $('.entity').unbind().click(function(){

        var analysis = "<span style='word-wrap: break-word'>";

        // display Wikipedia info only if wikilink exists
        var entity = this.innerText;
        var title = this.innerText.replace(/ /, '_').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
        var link = "https://en.wikipedia.org/wiki/" + title;

        wikiText = "";
        var wikiImg = "";
        wikiText += "<span style='word-wrap:break-word; text-align:left'><p style='margin-left: 1em'>";
        var realTitle = title;
          // get first sentence from Wikipedia
        $.getJSON("https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&exsentences=1&redirects&titles=" + title, function(data) {
            // if page exists on English Wikipedia, extract first sentence
            pageId = Object.keys(data["query"]["pages"])[0];
            if (data["query"]["pages"][pageId]["extract"]) {
              realTitle = data.query.pages[pageId].title
              analysis += "<span style='margin:auto'><span style='font-size:14px'><b>" + realTitle + "</b></span><br></span>";
              analysis += "<a href='" + link + "' target='blank'>" + link + "</a></span>";
              var extract = data["query"]["pages"][pageId]["extract"];
              console.log("Extract:", extract);
              if (extract.match(/</g).length > extract.match(/>/g).length || extract.length < 40) {
                $.getJSON("https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&exsentences=2&redirects&titles=" + title, function(data) {
                  pageId = Object.keys(data["query"]["pages"])[0];
                  addWikiText(["query"]["pages"][pageId]["extract"], false);
                })
              } else {
                addWikiText(extract, false);
              }
            } else {
              console.log("No wiki link found");
              var link = "https://www.google.com/search?q=" + entity.replace(/[&\\#,+'"()$=~%*{}]/g, ' ').split(' ').join('+');
              analysis += "<span style='margin:auto'><span style='font-size:14px'><b>" + entity + "</b></span><br></span>";
              analysis += '</span><br><input type="button" value="Google Search" class="googlebutton" onclick="window.open(\'' + link + '\')" ';
              analysis += 'style="font-size:14px; font-weight:bold; background-color:#e5e5e5; border-radius:2px; border:1px solid #e4e4e4; color:#666; padding:10px; cursor:pointer;" onMouseOver="this.style.color=\'#333\'; this.style.background=\'#f5f5f5\'" onMouseOut="this.style.background=\'#e4e4e4\'; this.style.color=\'#666\'" />';
            
            }
        });
        // detect first image title from wikipedia
        $.getJSON("https://en.wikipedia.org/w/api.php?format=json&action=query&prop=pageimages&titles=" + realTitle, function(data) {
          pageId = Object.keys(data.query.pages)[0];
          if(data.query.pages[pageId].pageimage){
            var imgURL = data.query.pages[pageId].thumbnail.source;
            console.log("Image URL:", imgURL);
            wikiImg += '<img src="' + imgURL + '" style="max-width:40%; max-height:140px; display:block; margin:0 auto; padding:5px; padding-top:15px; float:right">';
          }
        });

        $("#white-box2").html(analysis);
        $("#white-box2").append("<div id='wiki-text'>");
        $("#wiki-text").append(wikiImg);
        $("#wiki-text").append(wikiText);
        $("#wiki-text").css('overflow', 'hidden');
        $("#wiki-text").css('padding-top', 'hidden');
      });
    }

    var emotionAnalysisDone = false;
    function runEmotionAnalysis(translatedText) {
        // Find sentiment analysis scores through the Vader library
        const vader = require('vader-sentiment');
        const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(translatedText);

        $("#translation-box").append("<div id='emToggleContainer'><div id='emotionToggle'><h2 id='entity-label' style='color: white; margin-bottom: 4px; margin-top: 5px;background-color: #3b5998; border-radius: 4px; text-align:center; padding:2px;'> Emotion Analysis </h2></div><div id='eQuestion' style='color:gray; display:inline-block'>?</div></div><div id=\'emInfo\'></div>");

        $("#emToggleContainer").css('margin-top', '2px');
        $("#emToggleContainer").css('margin-bottom', '4px');

        $("#emotionToggle").css('display', 'inline-block');
        $("#emotionToggle").css('width', '89%');

        $("#eQuestion").css('color', 'white');
        $("#eQuestion").css('background-color', '#3b5998');
        $("#eQuestion").css('border-radius', '4px');
        $("#eQuestion").css('margin-top', '5px');
        $("#eQuestion").css('padding-top', '2.5px');
        $("#eQuestion").css('padding-bottom', '2.5px');
        $("#eQuestion").css('padding-right', '6px');
        $("#eQuestion").css('padding-left', '6px');
        $("#eQuestion").css('display', 'inline-block');
        $("#eQuestion").css('float', 'right'); 

        $("#emInfo").html("<p style='text-align:left'>Emotion analysis consists of two parts : Overall Sentiment classifies the overall contextual polarity (i.e. Negative - Positive) expressed in the post based on <a href='https://en.wikipedia.org/wiki/Sentiment_analysis'>sentiment analysis algorithms</a>. Emotion words analysis provides multi-dimensional sentiment analysis to interpret universal emotions expressed in the words of the post. It only appears when at least one of the 5 emotions (Joy, Fear, Sadness, Anger, Disgust) is over 50% likely to be present in the words of a post.</p>");        
        $("#emInfo").css('background-color', '#d7d9dc');
        $("#emInfo").css('height', 'auto');
        $("#emInfo").css('width', 'auto');
        $("#emInfo").css('text-align', 'center');
        $("#emInfo").css('padding', '10px');
        $("#emInfo").css('display', 'inline-block');
        $("#emInfo").css('width', 'calc(100% - 20px)');
        $("#emInfo").css('margin-bottom', '4px');
        $("#emInfo").hide(); //hide question box unless question button is clicked

        $("#eQuestion").click(function() { //slide question box down when button is clicked
          $("#emInfo").slideToggle();
        });

        if(!emotionAnalysisDone){
            //run sentiment-analysis
            $("#translation-box").append("<div id = 'white-box3'></div>");
            $("#white-box3").css('background-color', 'white');
            $("#white-box3").css('height', 'auto');
            $("#white-box3").css('width', 'auto');
            $("#white-box3").css('padding-top', '15px');
            $("#white-box3").css('padding-right', '15px');
            $("#white-box3").css('padding-left', '15px');
            $("#white-box3").css('padding-bottom', '15px');
            $("#white-box3").append("<div id='senHeader'><h2>Overall Sentiment</h2></div>");
            $("#senHeader").css('text-align', 'center');
            $("#senHeader").css('margin-bottom', '8px');

            var sentimentScore = intensity.compound;
            drawType(sentimentScore); //draw Strength and Type Boxes

            //draw sentiment analysis bars
            //draw emoticons and %

            drawSentAnalysisBars(sentimentScore);
            emotionAnalysisDone = true;
        }
    }
    
    function drawSentAnalysisBars(score) {
      $("#white-box3").append("<div id='analysis-bar-container'><div id='analysis-bar'></div><div id='indicator'></div></div>");
      var analysisBarImage = document.createElement('img');
      analysisBarImage.src = chrome.extension.getURL('/img/negpos_bar.png');

      $(analysisBarImage).css("width", "100%"); //have width be dependent on white-box3 width
      $(analysisBarImage).css("display", "inline-block");
      $(analysisBarImage).css("margin", "2px");
      $(analysisBarImage).css("margin-top", "4px");
      $(analysisBarImage).css("position", "absolute");

      $("#analysis-bar").append(analysisBarImage); //append element

      $("#analysis-bar").css("padding-top", "2px"); //style element

      $("#analysis-bar-container").css("position", "relative");
      $("#analysis-bar-container").css("margin-top", "10px");
      $("#analysis-bar-container").css("height", "50px");

      var divWidth = $("#white-box3").width() / 6.5; //distance of labels from bar
      var analysisBarWidth = $("#analysis-bar").width(); //width of bar
      var analysisBarPos = $("#analysis-bar").position().top;
      var position = analysisBarWidth / 2 + Number(score) * analysisBarWidth / 2; //calculate position of indicator

      if (isNaN(score)) { //set position to middle if undefined
        position = analysisBarWidth / 2;
      }
      //style indicator
      $("#indicator").css("width", "4px")
      $("#indicator").css("height", analysisBarWidth / 6.7 + "px");
      $("#indicator").css("border-radius", "3px");
      $("#indicator").css("background-color", "#000000");
      $("#indicator").css("position", "absolute");
      $("#indicator").css("z-index", "1");
      $("#indicator").css("left", position + "px"); //center bar and then change it by the score x width

      $("#analysis-bar-container").append("<div class='label' id='negative'>Negative</div><div class='label' id='positive'>Positive</div>"); //add positive and negative labels
      $(".label").css("position", "relative");
      $(".label").css("top", divWidth + "px");
      $(".label").css("display", "inline-block");

      $("#positive").css("float", "right"); //push to the right of the div
    }

    function drawType(sentimentScore) {
      if (sentimentScore == 0 || sentimentScore >= -.1 && sentimentScore <= .1 || isNaN(sentimentScore)) { //if there is only a type
        $("#white-box3").append("<div id = 'type-wrapper'><div class = 'analysis-box' id = 'strength'>Neutral</div></div>"); //neutral

        $("#type-wrapper").css("text-align", "center");

        $(".analysis-box").css("height", "20px");
        $(".analysis-box").css("width", "80px");
        $(".analysis-box").css("display", "inline-block");
        $(".analysis-box").css("text-align", "center");
        $(".analysis-box").css("color", "#FFFFFF");
        $(".analysis-box").css("border-radius", "4px");
        $(".analysis-box").css("padding-top", "2px");

        $("#strength").css("background-color", "#acacac"); //color
      } else { //if there is both a type and strength
        if (sentimentScore >= .00001 && sentimentScore <= .2) {
          $("#white-box3").append("<div id = 'type-wrapper'><div class = 'analysis-box' id = 'strength'>Slightly</div><div class = 'analysis-box' id = 'type'>Positive</div></div>"); //slightly pos

          $("#strength").css("background-color", "#acacac"); //colors
          $("#type").css("background-color", "#6fcf97");
        } else if (sentimentScore >= -.2 && sentimentScore <= -.00001) {
          $("#white-box3").append("<div id = 'type-wrapper'><div class = 'analysis-box' id = 'strength'>Slightly</div><div class = 'analysis-box' id = 'type'>Negative</div></div>"); //slightly neg

          $("#strength").css("background-color", "#acacac"); //colors
          $("#type").css("background-color", "#eb5757");
        } else if (sentimentScore >= .200001 && sentimentScore <= .6) {
          $("#white-box3").append("<div id = 'type-wrapper'><div class = 'analysis-box' id = 'strength'>Moderately</div><div class = 'analysis-box' id = 'type'>Positive</div></div>"); ///mod pos

          $("#strength").css("background-color", "#c1e96d"); //colors
          $("#type").css("background-color", "#6fcf97");
        } else if (sentimentScore >= -.6 && sentimentScore <= -.200001) {
          $("#white-box3").append("<div id = 'type-wrapper'><div class = 'analysis-box' id = 'strength'>Moderately</div><div class = 'analysis-box' id = 'type'>Negative</div></div>"); //mod neg

          $("#strength").css("background-color", "#fab53e"); //colors
          $("#type").css("background-color", "#eb5757");
        } else if (sentimentScore >= .600001 && sentimentScore <= 1) {
          $("#white-box3").append("<div id = 'type-wrapper'><div class = 'analysis-box' id = 'strength'>Strongly</div><div class = 'analysis-box' id = 'type'>Positive</div></div>"); //strong pos

          $("#strength").css("background-color", "#6fcf97"); //colors
          $("#type").css("background-color", "#6fcf97");
        } else if (sentimentScore >= -1 && sentimentScore <= -.600001) {
          $("#white-box3").append("<div id = 'type-wrapper'><div class = 'analysis-box' id = 'strength'>Strongly</div><div class = 'analysis-box' id = 'type'>Negative</div></div>"); //strong neg

          $("#strength").css("background-color", "#eb5757"); //colors
          $("#type").css("background-color", "#eb5757");
        }

        //styles 

        $("#type-wrapper").css("text-align", "center");

        $(".analysis-box").css("height", "20px");
        $(".analysis-box").css("width", "80px");
        $(".analysis-box").css("display", "inline-block");
        $(".analysis-box").css("text-align", "center");
        $(".analysis-box").css("color", "#FFFFFF");
        $(".analysis-box").css("border-radius", "4px");
        $(".analysis-box").css("padding-top", "2px");

        $("#strength").css("margin-right", "7.5px");
        $("#type").css("margin-left", "7.5px");
      }
    }
    // =====================================START=====================================
    jQuery.ajaxSetup({
      async: false
    });
    originalFull = main;
    if (linkText) {
      originalFull += ' ' + linkText;
    }
    main = main.replace(/[&\\#+$~%*{}]/g, ' ');
    main = main.replace(/([\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2694-\u2697]|\uD83E[\uDD10-\uDD5D])/g, '');
    main = main.replace(/([\u2764]|[\u2665])/g, '');
    linkText = linkText.replace(/([\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2694-\u2697]|\uD83E[\uDD10-\uDD5D])/g, '');
    linkText = linkText.replace(/([\u2764]|[\u2665])/g, '');

    // Get post ID
    fbId = getFbId($(this));

    var posterName = $(this).find("._6a._5u5j._6b").find(".fwn.fcg").find(".fwb").find("a")[0].innerText;
    var postTime = $(this).find("._5pcq").find("abbr")[0].title;

    if (main) {
      detectLanguage(main);
    } else if(linkText) {
      detectLanguage(linkText);
    }
  });
});
},{"compromise":2,"node-ner":3,"vader-sentiment":5}],2:[function(require,module,exports){
(function (global){
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.nlp = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(_dereq_,module,exports){
(function (global){
/* efrt trie-compression v2.0.3  github.com/nlp-compromise/efrt  - MIT */
!function(r){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=r();else if("function"==typeof define&&define.amd)define([],r);else{var e;e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,e.unpack=r()}}(function(){return function r(e,n,o){function t(u,f){if(!n[u]){if(!e[u]){var s="function"==typeof _dereq_&&_dereq_;if(!f&&s)return s(u,!0);if(i)return i(u,!0);var a=new Error("Cannot find module '"+u+"'");throw a.code="MODULE_NOT_FOUND",a}var c=n[u]={exports:{}};e[u][0].call(c.exports,function(r){var n=e[u][1][r];return t(n?n:r)},c,c.exports,r,e,n,o)}return n[u].exports}for(var i="function"==typeof _dereq_&&_dereq_,u=0;u<o.length;u++)t(o[u]);return t}({1:[function(r,e,n){"use strict";var o=36,t="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",i=t.split("").reduce(function(r,e,n){return r[e]=n,r},{}),u=function(r){if(void 0!==t[r])return t[r];for(var e=1,n=o,i="";r>=n;r-=n,e++,n*=o);for(;e--;){var u=r%o;i=String.fromCharCode((u<10?48:55)+u)+i,r=(r-u)/o}return i},f=function(r){if(void 0!==i[r])return i[r];for(var e=0,n=1,t=o,u=1;n<r.length;e+=t,n++,t*=o);for(var f=r.length-1;f>=0;f--,u*=o){var s=r.charCodeAt(f)-48;s>10&&(s-=7),e+=s*u}return e};e.exports={toAlphaCode:u,fromAlphaCode:f}},{}],2:[function(r,e,n){"use strict";var o=r("./unpack");e.exports=function(r){var e=r.split("|").reduce(function(r,e){var n=e.split("¦");return r[n[0]]=n[1],r},{}),n={};return Object.keys(e).forEach(function(r){var t=o(e[r]);"true"===r&&(r=!0);for(var i=0;i<t.length;i++){var u=t[i];n.hasOwnProperty(u)===!0?Array.isArray(n[u])===!1?n[u]=[n[u],r]:n[u].push(r):n[u]=r}}),n}},{"./unpack":4}],3:[function(r,e,n){"use strict";var o=r("../encoding");e.exports=function(r){for(var e=new RegExp("([0-9A-Z]+):([0-9A-Z]+)"),n=0;n<r.nodes.length;n++){var t=e.exec(r.nodes[n]);if(!t){r.symCount=n;break}r.syms[o.fromAlphaCode(t[1])]=o.fromAlphaCode(t[2])}r.nodes=r.nodes.slice(r.symCount,r.nodes.length)}},{"../encoding":1}],4:[function(r,e,n){"use strict";var o=r("./symbols"),t=r("../encoding"),i=function(r,e,n){var o=t.fromAlphaCode(e);return o<r.symCount?r.syms[o]:n+o+1-r.symCount},u=function(r){var e=[],n=function n(o,t){var u=r.nodes[o];"!"===u[0]&&(e.push(t),u=u.slice(1));for(var f=u.split(/([A-Z0-9,]+)/g),s=0;s<f.length;s+=2){var a=f[s],c=f[s+1];if(a){var d=t+a;if(","!==c&&void 0!==c){var p=i(r,c,o);n(p,d)}else e.push(d)}}};return n(0,""),e},f=function(r){var e={nodes:r.split(";"),syms:[],symCount:0};return r.match(":")&&o(e),u(e)};e.exports=f},{"../encoding":1,"./symbols":3}]},{},[2])(2)}),function(r){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=r();else if("function"==typeof define&&define.amd)define([],r);else{var e;e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,e.unpack=r()}}(function(){return function r(e,n,o){function t(u,f){if(!n[u]){if(!e[u]){var s="function"==typeof _dereq_&&_dereq_;if(!f&&s)return s(u,!0);if(i)return i(u,!0);var a=new Error("Cannot find module '"+u+"'");throw a.code="MODULE_NOT_FOUND",a}var c=n[u]={exports:{}};e[u][0].call(c.exports,function(r){var n=e[u][1][r];return t(n?n:r)},c,c.exports,r,e,n,o)}return n[u].exports}for(var i="function"==typeof _dereq_&&_dereq_,u=0;u<o.length;u++)t(o[u]);return t}({1:[function(r,e,n){"use strict";var o=36,t="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",i=t.split("").reduce(function(r,e,n){return r[e]=n,r},{}),u=function(r){if(void 0!==t[r])return t[r];for(var e=1,n=o,i="";r>=n;r-=n,e++,n*=o);for(;e--;){var u=r%o;i=String.fromCharCode((u<10?48:55)+u)+i,r=(r-u)/o}return i},f=function(r){if(void 0!==i[r])return i[r];for(var e=0,n=1,t=o,u=1;n<r.length;e+=t,n++,t*=o);for(var f=r.length-1;f>=0;f--,u*=o){var s=r.charCodeAt(f)-48;s>10&&(s-=7),e+=s*u}return e};e.exports={toAlphaCode:u,fromAlphaCode:f}},{}],2:[function(r,e,n){"use strict";var o=r("./unpack");e.exports=function(r){var e=r.split("|").reduce(function(r,e){var n=e.split("¦");return r[n[0]]=n[1],r},{}),n={};return Object.keys(e).forEach(function(r){var t=o(e[r]);"true"===r&&(r=!0);for(var i=0;i<t.length;i++){var u=t[i];n.hasOwnProperty(u)===!0?Array.isArray(n[u])===!1?n[u]=[n[u],r]:n[u].push(r):n[u]=r}}),n}},{"./unpack":4}],3:[function(r,e,n){"use strict";var o=r("../encoding");e.exports=function(r){for(var e=new RegExp("([0-9A-Z]+):([0-9A-Z]+)"),n=0;n<r.nodes.length;n++){var t=e.exec(r.nodes[n]);if(!t){r.symCount=n;break}r.syms[o.fromAlphaCode(t[1])]=o.fromAlphaCode(t[2])}r.nodes=r.nodes.slice(r.symCount,r.nodes.length)}},{"../encoding":1}],4:[function(r,e,n){"use strict";var o=r("./symbols"),t=r("../encoding"),i=function(r,e,n){var o=t.fromAlphaCode(e);return o<r.symCount?r.syms[o]:n+o+1-r.symCount},u=function(r){var e=[],n=function n(o,t){var u=r.nodes[o];"!"===u[0]&&(e.push(t),u=u.slice(1));for(var f=u.split(/([A-Z0-9,]+)/g),s=0;s<f.length;s+=2){var a=f[s],c=f[s+1];if(a){var d=t+a;if(","!==c&&void 0!==c){var p=i(r,c,o);n(p,d)}else e.push(d)}}};return n(0,""),e},f=function(r){var e={nodes:r.split(";"),syms:[],symCount:0};return r.match(":")&&o(e),u(e)};e.exports=f},{"../encoding":1,"./symbols":3}]},{},[2])(2)}),function(r){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=r();else if("function"==typeof define&&define.amd)define([],r);else{var e;e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,e.unpack=r()}}(function(){return function r(e,n,o){function t(u,f){if(!n[u]){if(!e[u]){var s="function"==typeof _dereq_&&_dereq_;if(!f&&s)return s(u,!0);if(i)return i(u,!0);var a=new Error("Cannot find module '"+u+"'");throw a.code="MODULE_NOT_FOUND",a}var c=n[u]={exports:{}};e[u][0].call(c.exports,function(r){var n=e[u][1][r];return t(n?n:r)},c,c.exports,r,e,n,o)}return n[u].exports}for(var i="function"==typeof _dereq_&&_dereq_,u=0;u<o.length;u++)t(o[u]);return t}({1:[function(r,e,n){"use strict";var o=36,t="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",i=t.split("").reduce(function(r,e,n){return r[e]=n,r},{}),u=function(r){if(void 0!==t[r])return t[r];for(var e=1,n=o,i="";r>=n;r-=n,e++,n*=o);for(;e--;){var u=r%o;i=String.fromCharCode((u<10?48:55)+u)+i,r=(r-u)/o}return i},f=function(r){if(void 0!==i[r])return i[r];for(var e=0,n=1,t=o,u=1;n<r.length;e+=t,n++,t*=o);for(var f=r.length-1;f>=0;f--,u*=o){var s=r.charCodeAt(f)-48;s>10&&(s-=7),e+=s*u}return e};e.exports={toAlphaCode:u,fromAlphaCode:f}},{}],2:[function(r,e,n){"use strict";var o=r("./unpack");e.exports=function(r){var e=r.split("|").reduce(function(r,e){var n=e.split("¦");return r[n[0]]=n[1],r},{}),n={};return Object.keys(e).forEach(function(r){var t=o(e[r]);"true"===r&&(r=!0);for(var i=0;i<t.length;i++){var u=t[i];n.hasOwnProperty(u)===!0?Array.isArray(n[u])===!1?n[u]=[n[u],r]:n[u].push(r):n[u]=r}}),n}},{"./unpack":4}],3:[function(r,e,n){"use strict";var o=r("../encoding");e.exports=function(r){for(var e=new RegExp("([0-9A-Z]+):([0-9A-Z]+)"),n=0;n<r.nodes.length;n++){var t=e.exec(r.nodes[n]);if(!t){r.symCount=n;break}r.syms[o.fromAlphaCode(t[1])]=o.fromAlphaCode(t[2])}r.nodes=r.nodes.slice(r.symCount,r.nodes.length)}},{"../encoding":1}],4:[function(r,e,n){"use strict";var o=r("./symbols"),t=r("../encoding"),i=function(r,e,n){var o=t.fromAlphaCode(e);return o<r.symCount?r.syms[o]:n+o+1-r.symCount},u=function(r){var e=[],n=function n(o,t){var u=r.nodes[o];"!"===u[0]&&(e.push(t),u=u.slice(1));for(var f=u.split(/([A-Z0-9,]+)/g),s=0;s<f.length;s+=2){var a=f[s],c=f[s+1];if(a){var d=t+a;if(","!==c&&void 0!==c){var p=i(r,c,o);n(p,d)}else e.push(d)}}};return n(0,""),e},f=function(r){var e={nodes:r.split(";"),syms:[],symCount:0};return r.match(":")&&o(e),u(e)};e.exports=f},{"../encoding":1,"./symbols":3}]},{},[2])(2)}),function(r){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=r();else if("function"==typeof define&&define.amd)define([],r);else{var e;e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,e.unpack=r()}}(function(){return function r(e,n,o){function t(u,f){if(!n[u]){if(!e[u]){var s="function"==typeof _dereq_&&_dereq_;if(!f&&s)return s(u,!0);if(i)return i(u,!0);var a=new Error("Cannot find module '"+u+"'");throw a.code="MODULE_NOT_FOUND",a}var c=n[u]={exports:{}};e[u][0].call(c.exports,function(r){var n=e[u][1][r];return t(n?n:r)},c,c.exports,r,e,n,o)}return n[u].exports}for(var i="function"==typeof _dereq_&&_dereq_,u=0;u<o.length;u++)t(o[u]);return t}({1:[function(r,e,n){"use strict";var o=36,t="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",i=t.split("").reduce(function(r,e,n){return r[e]=n,r},{}),u=function(r){if(void 0!==t[r])return t[r];for(var e=1,n=o,i="";r>=n;r-=n,e++,n*=o);for(;e--;){var u=r%o;i=String.fromCharCode((u<10?48:55)+u)+i,r=(r-u)/o}return i},f=function(r){if(void 0!==i[r])return i[r];for(var e=0,n=1,t=o,u=1;n<r.length;e+=t,n++,t*=o);for(var f=r.length-1;f>=0;f--,u*=o){var s=r.charCodeAt(f)-48;s>10&&(s-=7),e+=s*u}return e};e.exports={toAlphaCode:u,fromAlphaCode:f}},{}],2:[function(r,e,n){"use strict";var o=r("./unpack");e.exports=function(r){var e=r.split("|").reduce(function(r,e){var n=e.split("¦");return r[n[0]]=n[1],r},{}),n={};return Object.keys(e).forEach(function(r){var t=o(e[r]);"true"===r&&(r=!0);for(var i=0;i<t.length;i++){var u=t[i];n.hasOwnProperty(u)===!0?Array.isArray(n[u])===!1?n[u]=[n[u],r]:n[u].push(r):n[u]=r}}),n}},{"./unpack":4}],3:[function(r,e,n){"use strict";var o=r("../encoding");e.exports=function(r){for(var e=new RegExp("([0-9A-Z]+):([0-9A-Z]+)"),n=0;n<r.nodes.length;n++){var t=e.exec(r.nodes[n]);if(!t){r.symCount=n;break}r.syms[o.fromAlphaCode(t[1])]=o.fromAlphaCode(t[2])}r.nodes=r.nodes.slice(r.symCount,r.nodes.length)}},{"../encoding":1}],4:[function(r,e,n){"use strict";var o=r("./symbols"),t=r("../encoding"),i=function(r,e,n){var o=t.fromAlphaCode(e);return o<r.symCount?r.syms[o]:n+o+1-r.symCount},u=function(r){var e=[],n=function n(o,t){var u=r.nodes[o];"!"===u[0]&&(e.push(t),u=u.slice(1));for(var f=u.split(/([A-Z0-9,]+)/g),s=0;s<f.length;s+=2){var a=f[s],c=f[s+1];if(a){var d=t+a;if(","!==c&&void 0!==c){var p=i(r,c,o);n(p,d)}else e.push(d)}}};return n(0,""),e},f=function(r){var e={nodes:r.split(";"),syms:[],symCount:0};return r.match(":")&&o(e),u(e)};e.exports=f},{"../encoding":1,"./symbols":3}]},{},[2])(2)}),function(r){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=r();else if("function"==typeof define&&define.amd)define([],r);else{var e;e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,e.unpack=r()}}(function(){return function r(e,n,o){function t(u,f){if(!n[u]){if(!e[u]){var s="function"==typeof _dereq_&&_dereq_;if(!f&&s)return s(u,!0);if(i)return i(u,!0);var a=new Error("Cannot find module '"+u+"'");throw a.code="MODULE_NOT_FOUND",a}var c=n[u]={exports:{}};e[u][0].call(c.exports,function(r){var n=e[u][1][r];return t(n?n:r)},c,c.exports,r,e,n,o)}return n[u].exports}for(var i="function"==typeof _dereq_&&_dereq_,u=0;u<o.length;u++)t(o[u]);return t}({1:[function(r,e,n){"use strict";var o=36,t="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",i=t.split("").reduce(function(r,e,n){return r[e]=n,r},{}),u=function(r){if(void 0!==t[r])return t[r];for(var e=1,n=o,i="";r>=n;r-=n,e++,n*=o);for(;e--;){var u=r%o;i=String.fromCharCode((u<10?48:55)+u)+i,r=(r-u)/o}return i},f=function(r){if(void 0!==i[r])return i[r];for(var e=0,n=1,t=o,u=1;n<r.length;e+=t,n++,t*=o);for(var f=r.length-1;f>=0;f--,u*=o){var s=r.charCodeAt(f)-48;s>10&&(s-=7),e+=s*u}return e};e.exports={toAlphaCode:u,fromAlphaCode:f}},{}],2:[function(r,e,n){"use strict";var o=r("./unpack");e.exports=function(r){var e=r.split("|").reduce(function(r,e){var n=e.split("¦");return r[n[0]]=n[1],r},{}),n={};return Object.keys(e).forEach(function(r){var t=o(e[r]);"true"===r&&(r=!0);for(var i=0;i<t.length;i++){var u=t[i];n.hasOwnProperty(u)===!0?Array.isArray(n[u])===!1?n[u]=[n[u],r]:n[u].push(r):n[u]=r}}),n}},{"./unpack":4}],3:[function(r,e,n){"use strict";var o=r("../encoding");e.exports=function(r){for(var e=new RegExp("([0-9A-Z]+):([0-9A-Z]+)"),n=0;n<r.nodes.length;n++){var t=e.exec(r.nodes[n]);if(!t){r.symCount=n;break}r.syms[o.fromAlphaCode(t[1])]=o.fromAlphaCode(t[2])}r.nodes=r.nodes.slice(r.symCount,r.nodes.length)}},{"../encoding":1}],4:[function(r,e,n){"use strict";var o=r("./symbols"),t=r("../encoding"),i=function(r,e,n){var o=t.fromAlphaCode(e);return o<r.symCount?r.syms[o]:n+o+1-r.symCount},u=function(r){var e=[],n=function n(o,t){var u=r.nodes[o];"!"===u[0]&&(e.push(t),u=u.slice(1));for(var f=u.split(/([A-Z0-9,]+)/g),s=0;s<f.length;s+=2){var a=f[s],c=f[s+1];if(a){var d=t+a;if(","!==c&&void 0!==c){var p=i(r,c,o);n(p,d)}else e.push(d)}}};return n(0,""),e},f=function(r){var e={nodes:r.split(";"),syms:[],symCount:0};return r.match(":")&&o(e),u(e)};e.exports=f},{"../encoding":1,"./symbols":3}]},{},[2])(2)}),function(r){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=r();else if("function"==typeof define&&define.amd)define([],r);else{var e;e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,e.unpack=r()}}(function(){return function r(e,n,o){function t(u,f){if(!n[u]){if(!e[u]){var s="function"==typeof _dereq_&&_dereq_;if(!f&&s)return s(u,!0);if(i)return i(u,!0);var a=new Error("Cannot find module '"+u+"'");throw a.code="MODULE_NOT_FOUND",a}var c=n[u]={exports:{}};e[u][0].call(c.exports,function(r){var n=e[u][1][r];return t(n?n:r)},c,c.exports,r,e,n,o)}return n[u].exports}for(var i="function"==typeof _dereq_&&_dereq_,u=0;u<o.length;u++)t(o[u]);return t}({1:[function(r,e,n){"use strict";var o=36,t="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",i=t.split("").reduce(function(r,e,n){return r[e]=n,r},{}),u=function(r){if(void 0!==t[r])return t[r];for(var e=1,n=o,i="";r>=n;r-=n,e++,n*=o);for(;e--;){var u=r%o;i=String.fromCharCode((u<10?48:55)+u)+i,r=(r-u)/o}return i},f=function(r){if(void 0!==i[r])return i[r];for(var e=0,n=1,t=o,u=1;n<r.length;e+=t,n++,t*=o);for(var f=r.length-1;f>=0;f--,u*=o){var s=r.charCodeAt(f)-48;s>10&&(s-=7),e+=s*u}return e};e.exports={toAlphaCode:u,fromAlphaCode:f}},{}],2:[function(r,e,n){"use strict";var o=r("./unpack");e.exports=function(r){var e=r.split("|").reduce(function(r,e){var n=e.split("¦");return r[n[0]]=n[1],r},{}),n={};return Object.keys(e).forEach(function(r){var t=o(e[r]);"true"===r&&(r=!0);for(var i=0;i<t.length;i++){var u=t[i];n.hasOwnProperty(u)===!0?Array.isArray(n[u])===!1?n[u]=[n[u],r]:n[u].push(r):n[u]=r}}),n}},{"./unpack":4}],3:[function(r,e,n){"use strict";var o=r("../encoding");e.exports=function(r){for(var e=new RegExp("([0-9A-Z]+):([0-9A-Z]+)"),n=0;n<r.nodes.length;n++){var t=e.exec(r.nodes[n]);if(!t){r.symCount=n;break}r.syms[o.fromAlphaCode(t[1])]=o.fromAlphaCode(t[2])}r.nodes=r.nodes.slice(r.symCount,r.nodes.length)}},{"../encoding":1}],4:[function(r,e,n){"use strict";var o=r("./symbols"),t=r("../encoding"),i=function(r,e,n){var o=t.fromAlphaCode(e);return o<r.symCount?r.syms[o]:n+o+1-r.symCount},u=function(r){var e=[],n=function n(o,t){var u=r.nodes[o];"!"===u[0]&&(e.push(t),u=u.slice(1));for(var f=u.split(/([A-Z0-9,]+)/g),s=0;s<f.length;s+=2){var a=f[s],c=f[s+1];if(a){var d=t+a;if(","!==c&&void 0!==c){var p=i(r,c,o);n(p,d)}else e.push(d)}}};return n(0,""),e},f=function(r){var e={nodes:r.split(";"),syms:[],symCount:0};return r.match(":")&&o(e),u(e)};e.exports=f},{"../encoding":1,"./symbols":3}]},{},[2])(2)});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],2:[function(_dereq_,module,exports){
module.exports={
  "author": "Spencer Kelly <spencermountain@gmail.com> (http://spencermounta.in)",
  "name": "compromise",
  "description": "natural language processing in the browser",
  "version": "11.12.3",
  "main": "./builds/compromise.js",
  "types": "./compromise.d.ts",
  "repository": {
    "type": "git",
    "url": "git://github.com/nlp-compromise/compromise.git"
  },
  "scripts": {
    "test": "tape \"./test/unit/**/*.test.js\" | tap-dancer",
    "test:spec": "tape \"./test/unit/**/*.test.js\" | tap-spec",
    "testb": "TESTENV=prod tape \"./test/unit/**/*.test.js\" | tap-spec",
    "buildTest": "TESTENV=prod node ./scripts/test.js",
    "test:types": "tsc --project test/types",
    "browserTest": "node ./scripts/browserTest.js",
    "benchmark": "node ./scripts/benchmark.js",
    "build": "node ./scripts/build/index.js",
    "pack": "node ./scripts/pack.js",
    "prepublishOnly": "node ./scripts/prepublish",
    "postpublish": "node ./scripts/postpublish",
    "watch": "amble ./scratch.js",
    "filesize": "node ./scripts/lib/filesize.js",
    "coverage": "node ./scripts/postpublish/coverage.js",
    "lint": "node ./scripts/prepublish/linter.js"
  },
  "files": [
    "builds/",
    "docs/",
    "compromise.d.ts"
  ],
  "dependencies": {
    "efrt-unpack": "2.0.3"
  },
  "devDependencies": {
    "amble": "0.0.6",
    "babel-preset-env": "1.7.0",
    "babelify": "7.3.0",
    "babili": "0.1.4",
    "browserify": "13.0.1",
    "chalk": "2.4.1",
    "compromise-plugin": "0.0.8",
    "derequire": "2.0.6",
    "eslint": "5.1.0",
    "nyc": "11.8.0",
    "shelljs": "0.8.2",
    "tap-spec": "^5.0.0",
    "tap-dancer": "0.1.2",
    "tape": "4.9.1",
    "uglify-js": "3.4.9"
  },
  "license": "MIT"
}

},{}],3:[function(_dereq_,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var tagset = _dereq_('./tags');

// https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
var c = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  black: '\x1b[30m'
};
//dont use colors on client-side
if (typeof module === 'undefined') {
  Object.keys(c).forEach(function (k) {
    c[k] = '';
  });
}

//coerce any input into a string
exports.ensureString = function (input) {
  if (typeof input === 'string') {
    return input;
  } else if (typeof input === 'number') {
    return String(input);
  }
  return '';
};
//coerce any input into a string
exports.ensureObject = function (input) {
  if ((typeof input === 'undefined' ? 'undefined' : _typeof(input)) !== 'object') {
    return {};
  }
  if (input === null || input instanceof Array) {
    return {};
  }
  return input;
};

exports.titleCase = function (str) {
  return str.charAt(0).toUpperCase() + str.substr(1);
};

//shallow-clone an object
exports.copy = function (o) {
  var o2 = {};
  o = exports.ensureObject(o);
  Object.keys(o).forEach(function (k) {
    o2[k] = o[k];
  });
  return o2;
};
exports.extend = function (obj, a) {
  obj = exports.copy(obj);
  var keys = Object.keys(a);
  for (var i = 0; i < keys.length; i++) {
    obj[keys[i]] = a[keys[i]];
  }
  return obj;
};

//colorization
exports.green = function (str) {
  return c.green + str + c.reset;
};
exports.red = function (str) {
  return c.red + str + c.reset;
};
exports.blue = function (str) {
  return c.blue + str + c.reset;
};
exports.magenta = function (str) {
  return c.magenta + str + c.reset;
};
exports.cyan = function (str) {
  return c.cyan + str + c.reset;
};
exports.yellow = function (str) {
  return c.yellow + str + c.reset;
};
exports.black = function (str) {
  return c.black + str + c.reset;
};
exports.printTag = function (tag) {
  if (tagset[tag]) {
    var color = tagset[tag].color || 'blue';
    return exports[color](tag);
  }
  return tag;
};
exports.printTerm = function (t) {
  var tags = Object.keys(t.tags);
  for (var i = 0; i < tags.length; i++) {
    if (tagset[tags[i]]) {
      var color = tagset[tags[i]].color || 'black';
      return exports[color](t.out('text'));
    }
  }
  return c.reset + t.plaintext + c.reset;
};

exports.leftPad = function (str, width, char) {
  char = char || ' ';
  str = str.toString();
  while (str.length < width) {
    str += char;
  }
  return str;
};

exports.isArray = function (arr) {
  return Object.prototype.toString.call(arr) === '[object Array]';
};

exports.isObject = function (obj) {
  return obj === Object(obj);
};

},{"./tags":137}],4:[function(_dereq_,module,exports){
(function (global){
'use strict';

var buildText = _dereq_('./text/build');
var pkg = _dereq_('../package.json');
var log = _dereq_('./log');
var unpack = _dereq_('./world/unpack');
var world = _dereq_('./world');
var w = world.w;

//the main function
var nlp = function nlp(str, lex) {
  if (lex) {
    w.plugin({
      words: lex
    });
  }
  var doc = buildText(str, w);
  doc.tagger();
  return doc;
};

//this is used, atleast, for testing the packing
nlp.unpack = function (plugin) {
  return unpack(plugin);
};
//this is handy
nlp.version = pkg.version;
//turn-on some debugging
nlp.verbose = function (str) {
  log.enable(str);
};
//same as main method, except with no POS-tagging.
nlp.tokenize = function (str) {
  return buildText(str);
};

//uncompress user-submitted lexicon
nlp.plugin = function (plugin) {
  w.plugin(plugin);
};
//contribute words to the lexicon
nlp.addWords = function (lex) {
  w.plugin({
    words: lex
  });
};
nlp.addTags = function (tags) {
  w.plugin({
    tags: tags
  });
};
nlp.addRegex = function (regex) {
  w.plugin({
    regex: regex
  });
};
nlp.addPatterns = function (patterns) {
  w.plugin({
    patterns: patterns
  });
};
nlp.addPlurals = function (plurals) {
  w.plugin({
    plurals: plurals
  });
};
nlp.addConjugations = function (conj) {
  w.plugin({
    conjugations: conj
  });
};

//make a weird, half-copy of this method
nlp.clone = function () {
  var w2 = world.reBuild();
  //this is weird, but it's okay
  var nlp2 = function nlp2(str, lex) {
    if (lex) {
      w2.plugin({
        words: lex
      });
    }
    var doc = buildText(str, w2);
    doc.tagger();
    return doc;
  };
  nlp2.tokenize = nlp.tokenize;
  nlp2.verbose = nlp.verbose;
  nlp2.version = nlp.version;
  ['Words', 'Tags', 'Regex', 'Patterns', 'Plurals', 'Conjugations'].forEach(function (fn) {
    nlp2['add' + fn] = function (obj) {
      w2['add' + fn](obj);
    };
  });
  return nlp2;
};

//and then all-the-exports...
if (typeof self !== 'undefined') {
  self.nlp = nlp; // Web Worker
} else if (typeof window !== 'undefined') {
  window.nlp = nlp; // Browser
} else if (typeof global !== 'undefined') {
  global.nlp = nlp; // NodeJS
}
//don't forget amd!
if (typeof define === 'function' && define.amd) {
  define(nlp);
}
//then for some reason, do this too!
if (typeof module !== 'undefined') {
  module.exports = nlp;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../package.json":2,"./log":6,"./text/build":190,"./world":215,"./world/unpack":223}],5:[function(_dereq_,module,exports){
'use strict';

var fns = _dereq_('../fns');

// const colors = {
//   'Person': '#6393b9',
//   'Pronoun': '#81acce',
//   'Noun': 'steelblue',
//   'Verb': 'palevioletred',
//   'Adverb': '#f39c73',
//   'Adjective': '#b3d3c6',
//   'Determiner': '#d3c0b3',
//   'Preposition': '#9794a8',
//   'Conjunction': '#c8c9cf',
//   'Value': 'palegoldenrod',
//   'Expression': '#b3d3c6'
// };

var tag = function tag(t, pos, reason) {
  var title = t.normal || '[' + t.silent_term + ']';
  title = fns.leftPad('\'' + title + '\'', 12);
  title += '  ->   ' + pos;
  title += fns.leftPad(reason || '', 15);
  console.log('%c' + title, ' color: #a2c99c');
};
var untag = function untag(t, pos, reason) {
  var title = t.normal || '[' + t.silent_term + ']';
  title = fns.leftPad('\'' + title + '\'', 12);
  title += '  ~*   ' + pos;
  title += '    ' + (reason || '');
  console.log('%c' + title, ' color: #b66a6a');
};
module.exports = {
  tag: tag,
  untag: untag
};

},{"../fns":3}],6:[function(_dereq_,module,exports){
'use strict';

var client = _dereq_('./client');
var server = _dereq_('./server');

var _enable = false;

module.exports = {
  enable: function enable(str) {
    if (str === undefined) {
      str = true;
    }
    _enable = str;
  },
  tag: function tag(t, pos, reason) {
    if (_enable === true || _enable === 'tagger') {
      if (typeof window !== 'undefined') {
        client.tag(t, pos, reason);
      } else {
        server.tag(t, pos, reason);
      }
    }
  },
  unTag: function unTag(t, pos, reason) {
    if (_enable === true || _enable === 'tagger') {
      if (typeof window !== 'undefined') {
        client.untag(t, pos, reason);
      } else {
        server.untag(t, pos, reason);
      }
    }
  }
};

},{"./client":5,"./server":7}],7:[function(_dereq_,module,exports){
'use strict';

var fns = _dereq_('../fns');

//use weird bash escape things for some colors
var tag = function tag(t, pos, reason) {
  var title = t.normal || '[' + t.silent_term + ']';
  title = fns.yellow(title);
  title = fns.leftPad('\'' + title + '\'', 20);
  title += '  ->   ' + fns.printTag(pos);
  title = fns.leftPad(title, 54);
  console.log('       ' + title + '(' + fns.cyan(reason || '') + ')');
};

var untag = function untag(t, pos, reason) {
  var title = '-' + t.normal + '-';
  title = fns.red(title);
  title = fns.leftPad(title, 20);
  title += '  ~*   ' + fns.red(pos);
  title = fns.leftPad(title, 54);
  console.log('       ' + title + '(' + fns.red(reason || '') + ')');
};

module.exports = {
  tag: tag,
  untag: untag
};

},{"../fns":3}],8:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  fns: _dereq_('./fns'),
  Terms: _dereq_('./terms')
};

},{"./fns":3,"./terms":165}],9:[function(_dereq_,module,exports){
'use strict';

var Text = _dereq_('../../text');
//the Acronym() subset class

var methods = {
  stripPeriods: function stripPeriods() {
    this.list.forEach(function (ts) {
      ts.terms.forEach(function (t) {
        var chars = t._text.split('.');
        if (chars.length > 2) {
          t.text = chars.join('');
        }
      });
    });
    return this;
  },
  addPeriods: function addPeriods() {
    this.list.forEach(function (ts) {
      ts.terms.forEach(function (t) {
        var chars = t._text.split('.');
        if (chars.length > 2) {
          var str = t._text.replace(/\./g, '');
          t.text = str.split('').join('.') + '.';
        }
      });
    });
    return this;
  },
  data: function data() {
    return this.terms().list.map(function (ts) {
      var t = ts.terms[0];
      var parsed = t.text.toUpperCase().replace(/\./g, '').split('');
      return {
        periods: parsed.join('.'),
        normal: parsed.join(''),
        text: t.text
      };
    });
  }
};

var find = function find(r, n) {
  r = r.match('#Acronym');
  if (typeof n === 'number') {
    r = r.get(n);
  }
  return r;
};

module.exports = Text.makeSubset(methods, find);

},{"../../text":192}],10:[function(_dereq_,module,exports){
'use strict';

var Text = _dereq_('../../text');
var fns = _dereq_('./methods');
//the Adjectives() subset class

//is this an adjective we want to goof-around with?
var shouldConvert = function shouldConvert(str, words) {
  if (!str || str.length <= 3) {
    return false;
  }
  if (words[str] === 'Comparable') {
    return true;
  }
  if (words[str] === 'Adjective') {
    return false;
  }
  //has space
  if (str.indexOf(' ') !== -1) {
    return false;
  }
  return true;
};

var methods = {
  data: function data() {
    var _this = this;

    return this.list.map(function (ts) {
      var str = ts.out('normal');
      var obj = {
        normal: str,
        text: _this.out('text'),
        comparative: 'more ' + str,
        superlative: 'most ' + str,
        adverbForm: null,
        nounForm: null
        // verbForm: null
      };
      if (shouldConvert(str, _this.world().words) === true) {
        obj.comparative = fns.toComparative(str) || obj.comparative;
        obj.superlative = fns.toSuperlative(str) || obj.superlative;
        obj.adverbForm = fns.toAdverb(str);
        obj.nounForm = fns.toNoun(str);
        // obj.verbForm = fns.toVerb(str);
      }
      return obj;
    });
  }
};

var find = function find(r, n) {
  r = r.match('#Adjective');
  if (typeof n === 'number') {
    r = r.get(n);
  }
  return r;
};

module.exports = Text.makeSubset(methods, find);

},{"../../text":192,"./methods":11}],11:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  toNoun: _dereq_('./toNoun'),
  toSuperlative: _dereq_('./toSuperlative'),
  toComparative: _dereq_('./toComparative'),
  toAdverb: _dereq_('./toAdverb'),
  toVerb: _dereq_('./toVerb')
};

},{"./toAdverb":12,"./toComparative":13,"./toNoun":14,"./toSuperlative":15,"./toVerb":16}],12:[function(_dereq_,module,exports){
//turn 'quick' into 'quickly'
'use strict';

var not_matches = [/airs$/, /ll$/, /ee.$/, /ile$/, /y$/];
var irregulars = _dereq_('../../../world/more-data/irregularAdjectives').toAdverb;

var transforms = [{
  reg: /al$/i,
  repl: 'ally'
}, {
  reg: /ly$/i,
  repl: 'ly'
}, {
  reg: /(.{3})y$/i,
  repl: '$1ily'
}, {
  reg: /que$/i,
  repl: 'quely'
}, {
  reg: /ue$/i,
  repl: 'uly'
}, {
  reg: /ic$/i,
  repl: 'ically'
}, {
  reg: /ble$/i,
  repl: 'bly'
}, {
  reg: /l$/i,
  repl: 'ly'
}];

var adj_to_adv = function adj_to_adv(str) {
  if (irregulars.hasOwnProperty(str) === true) {
    return irregulars[str];
  }
  for (var i = 0; i < not_matches.length; i++) {
    if (not_matches[i].test(str) === true) {
      return null;
    }
  }
  for (var _i = 0; _i < transforms.length; _i++) {
    if (transforms[_i].reg.test(str) === true) {
      return str.replace(transforms[_i].reg, transforms[_i].repl);
    }
  }
  return str + 'ly';
};
// console.log(adj_to_adv('good'));

module.exports = adj_to_adv;

},{"../../../world/more-data/irregularAdjectives":218}],13:[function(_dereq_,module,exports){
//turn 'quick' into 'quickly'
'use strict';

var do_rules = [/ght$/, /nge$/, /ough$/, /ain$/, /uel$/, /[au]ll$/, /ow$/, /old$/, /oud$/, /e[ae]p$/];
var dont_rules = [/ary$/, /ous$/];
var irregulars = _dereq_('../../../world/more-data/irregularAdjectives').toComparative;

var transforms = [{
  reg: /y$/i,
  repl: 'ier'
}, {
  reg: /([aeiou])t$/i,
  repl: '$1tter'
}, {
  reg: /([aeou])de$/i,
  repl: '$1der'
}, {
  reg: /nge$/i,
  repl: 'nger'
}];

var to_comparative = function to_comparative(str) {
  //known-irregulars
  if (irregulars.hasOwnProperty(str)) {
    return irregulars[str];
  }
  //known-transforms
  for (var i = 0; i < transforms.length; i++) {
    if (transforms[i].reg.test(str) === true) {
      return str.replace(transforms[i].reg, transforms[i].repl);
    }
  }
  //dont-patterns
  for (var _i = 0; _i < dont_rules.length; _i++) {
    if (dont_rules[_i].test(str) === true) {
      return null;
    }
  }
  //do-patterns
  for (var _i2 = 0; _i2 < do_rules.length; _i2++) {
    if (do_rules[_i2].test(str) === true) {
      return str + 'er';
    }
  }
  //easy-one
  if (/e$/.test(str) === true) {
    return str + 'r';
  }
  return str + 'er';
  // return null;
};

// console.log(to_comparative('big'));

module.exports = to_comparative;

},{"../../../world/more-data/irregularAdjectives":218}],14:[function(_dereq_,module,exports){
'use strict';
//convert 'cute' to 'cuteness'

var irregulars = {
  clean: 'cleanliness',
  naivety: 'naivety',
  hurt: 'hurt'
};

var transforms = [{
  reg: /y$/,
  repl: 'iness'
}, {
  reg: /le$/,
  repl: 'ility'
}, {
  reg: /ial$/,
  repl: 'y'
}, {
  reg: /al$/,
  repl: 'ality'
}, {
  reg: /ting$/,
  repl: 'ting'
}, {
  reg: /ring$/,
  repl: 'ring'
}, {
  reg: /bing$/,
  repl: 'bingness'
}, {
  reg: /sing$/,
  repl: 'se'
}, {
  reg: /ing$/,
  repl: 'ment'
}, {
  reg: /ess$/,
  repl: 'essness'
}, {
  reg: /ous$/,
  repl: 'ousness'
}];

var to_noun = function to_noun(w) {
  if (irregulars.hasOwnProperty(w)) {
    return irregulars[w];
  }
  var lastChar = w.charAt(w.length - 1);
  if (lastChar === 'w' || lastChar === 's') {
    return null;
  }
  for (var i = 0; i < transforms.length; i++) {
    if (transforms[i].reg.test(w) === true) {
      return w.replace(transforms[i].reg, transforms[i].repl);
    }
  }
  return w + 'ness';
};

module.exports = to_noun;
// console.log(to_noun("great"))

},{}],15:[function(_dereq_,module,exports){
//turn 'quick' into 'quickest'
'use strict';

var do_rules = [/ght$/, /nge$/, /ough$/, /ain$/, /uel$/, /[au]ll$/, /ow$/, /oud$/, /...p$/];
var dont_rules = [/ary$/];
var irregulars = _dereq_('../../../world/more-data/irregularAdjectives').toSuperlative;

var transforms = [{
  reg: /y$/i,
  repl: 'iest'
}, {
  reg: /([aeiou])t$/i,
  repl: '$1ttest'
}, {
  reg: /([aeou])de$/i,
  repl: '$1dest'
}, {
  reg: /nge$/i,
  repl: 'ngest'
}, {
  reg: /([aeiou])te$/i,
  repl: '$1test'
}];

var to_superlative = function to_superlative(str) {
  //irregulars
  if (irregulars.hasOwnProperty(str)) {
    return irregulars[str];
  }
  //known transforms
  for (var i = 0; i < transforms.length; i++) {
    if (transforms[i].reg.test(str)) {
      return str.replace(transforms[i].reg, transforms[i].repl);
    }
  }
  //dont-rules
  for (var _i = 0; _i < dont_rules.length; _i++) {
    if (dont_rules[_i].test(str) === true) {
      return null;
    }
  }
  //do-rules
  for (var _i2 = 0; _i2 < do_rules.length; _i2++) {
    if (do_rules[_i2].test(str) === true) {
      if (str.charAt(str.length - 1) === 'e') {
        return str + 'st';
      }
      return str + 'est';
    }
  }
  return str + 'est';
};

module.exports = to_superlative;
// console.log(to_superlative("great"))

},{"../../../world/more-data/irregularAdjectives":218}],16:[function(_dereq_,module,exports){
'use strict';
//turn an adjective like 'soft' into a verb like 'soften'
//(don't do words like 'green' -> 'greenen')

var irregulars = {
  red: 'redden',
  sad: 'sadden',
  fat: 'fatten'
};

var toVerb = function toVerb(str) {
  if (irregulars.hasOwnProperty(str) === true) {
    return irregulars[str];
  }
  if (/e$/.test(str) === true) {
    return str + 'n';
  }
  return str + 'en';
};
module.exports = toVerb;

},{}],17:[function(_dereq_,module,exports){
'use strict';

var Text = _dereq_('../../text');
var toAdjective = _dereq_('./toAdjective');

//the () subset class

var methods = {
  data: function data() {
    return this.terms().list.map(function (ts) {
      var t = ts.terms[0];
      return {
        adjectiveForm: toAdjective(t.normal),
        normal: t.normal,
        text: t.text
      };
    });
  }
};

var find = function find(r, n) {
  r = r.splitAfter('#Comma');
  r = r.match('#Adverb+');
  if (typeof n === 'number') {
    r = r.get(n);
  }
  return r;
};

module.exports = Text.makeSubset(methods, find);

},{"../../text":192,"./toAdjective":18}],18:[function(_dereq_,module,exports){
//turns 'quickly' into 'quick'
'use strict';

var irregulars = {
  'idly': 'idle',
  'sporadically': 'sporadic',
  'basically': 'basic',
  'grammatically': 'grammatical',
  'alphabetically': 'alphabetical',
  'economically': 'economical',
  'conically': 'conical',
  'politically': 'political',
  'vertically': 'vertical',
  'practically': 'practical',
  'theoretically': 'theoretical',
  'critically': 'critical',
  'fantastically': 'fantastic',
  'mystically': 'mystical',
  'pornographically': 'pornographic',
  'fully': 'full',
  'jolly': 'jolly',
  'wholly': 'whole'
};

var transforms = [{
  'reg': /bly$/i,
  'repl': 'ble'
}, {
  'reg': /gically$/i,
  'repl': 'gical'
}, {
  'reg': /([rsdh])ically$/i,
  'repl': '$1ical'
}, {
  'reg': /ically$/i,
  'repl': 'ic'
}, {
  'reg': /uly$/i,
  'repl': 'ue'
}, {
  'reg': /ily$/i,
  'repl': 'y'
}, {
  'reg': /(.{3})ly$/i,
  'repl': '$1'
}];

var toAdjective = function toAdjective(str) {
  if (irregulars.hasOwnProperty(str)) {
    return irregulars[str];
  }
  for (var i = 0; i < transforms.length; i++) {
    if (transforms[i].reg.test(str) === true) {
      return str.replace(transforms[i].reg, transforms[i].repl);
    }
  }
  return str;
};

// console.log(toAdjective('quickly'))
module.exports = toAdjective;

},{}],19:[function(_dereq_,module,exports){
'use strict';

//the plumbing to turn two words into a contraction

var combine = function combine(a, b) {
  b.whitespace.after = a.whitespace.after;
  a.whitespace.after = '';
  b.whitespace.before = '';
  a.silent_term = a.text;
  b.silent_term = b.text;
  b.text = '';
  a.tag('Contraction', 'new-contraction');
  b.tag('Contraction', 'new-contraction');
};

var irregulars = {
  can: 'can\'t',
  will: 'won\'t'
};

var contract = function contract(ts) {
  if (ts.expanded === false || ts.match('#Contraction').found) {
    return ts;
  }
  //he is -> he's
  ts.match('(#Noun|#QuestionWord) is').list.forEach(function (ls) {
    combine(ls.terms[0], ls.terms[1]);
    ls.terms[0].text += '\'s';
    ls.contracted = true;
  });
  //he did -> he'd
  ts.match('#PronNoun did').list.forEach(function (ls) {
    combine(ls.terms[0], ls.terms[1]);
    ls.terms[0].text += '\'d';
    ls.contracted = true;
  });
  //how do -> how'd
  ts.match('#QuestionWord (did|do)').list.forEach(function (ls) {
    combine(ls.terms[0], ls.terms[1]);
    ls.terms[0].text += '\'d';
    ls.contracted = true;
  });
  //he would -> he'd
  ts.match('#Noun (could|would)').list.forEach(function (ls) {
    combine(ls.terms[0], ls.terms[1]);
    ls.terms[0].text += '\'d';
    ls.contracted = true;
  });
  //they are -> they're
  ts.match('(they|we|you) are').list.forEach(function (ls) {
    combine(ls.terms[0], ls.terms[1]);
    ls.terms[0].text += '\'re';
    ls.contracted = true;
  });
  //i am -> i'm
  ts.match('i am').list.forEach(function (ls) {
    combine(ls.terms[0], ls.terms[1]);
    ls.terms[0].text += '\'m';
    ls.contracted = true;
  });
  //they will -> they'll
  ts.match('(#Noun|#QuestionWord) will').list.forEach(function (ls) {
    combine(ls.terms[0], ls.terms[1]);
    ls.terms[0].text += '\'ll';
    ls.contracted = true;
  });
  //they have -> they've
  ts.match('(they|we|you|i) have').list.forEach(function (ls) {
    combine(ls.terms[0], ls.terms[1]);
    ls.terms[0].text += '\'ve';
    ls.contracted = true;
  });
  //is not -> isn't
  ts.match('(#Copula|#Modal|do|does|have|has|can|will) not').list.forEach(function (ls) {
    combine(ls.terms[0], ls.terms[1]);
    //can't, won't
    if (irregulars.hasOwnProperty(ls.terms[0].text) === true) {
      ls.terms[0].text = irregulars[ls.terms[0].text];
    } else {
      ls.terms[0].text += 'n\'t';
    }
    ls.contracted = true;
  });
  return ts;
};

module.exports = contract;

},{}],20:[function(_dereq_,module,exports){
'use strict';

var Terms = _dereq_('../../paths').Terms;
var contract = _dereq_('./contract');
var expand = _dereq_('./expand');

var ContractionCl = function ContractionCl(arr, world, original) {
  Terms.call(this, arr, world, original);
};

//Inherit properties
ContractionCl.prototype = Object.create(Terms.prototype);

ContractionCl.prototype.data = function () {
  var expanded = expand(this.clone());
  var contracted = contract(this.clone());
  return {
    text: this.out('text'),
    normal: this.out('normal'),
    expanded: {
      normal: expanded.out('normal'),
      text: expanded.out('text')
    },
    contracted: {
      normal: contracted.out('normal'),
      text: contracted.out('text')
    },
    isContracted: Boolean(this.contracted)
  };
};
ContractionCl.prototype.expand = function () {
  return expand(this);
};
ContractionCl.prototype.contract = function () {
  return contract(this);
};
module.exports = ContractionCl;

},{"../../paths":8,"./contract":19,"./expand":21}],21:[function(_dereq_,module,exports){
'use strict';
//turn `i'd` into `i would`

var expand = function expand(ts) {
  if (ts.contracted === false) {
    return ts;
  }
  ts.terms.forEach(function (t) {
    if (t.silent_term) {
      //this term also needs a space now too
      if (!t.text) {
        t.whitespace.before = ' ';
      }
      t._text = t.silent_term;
      //handle (some) capitalization
      if (t.tags.TitleCase) {
        t.toTitleCase();
      }
      t.normalize();
      t.silent_term = null;
      t.unTag('Contraction', 'expanded');
    }
  });
  return ts;
};
module.exports = expand;

},{}],22:[function(_dereq_,module,exports){
'use strict';
//find contractable, expanded-contractions

var find = function find(r) {
  var remain = r.not('#Contraction');
  var m = remain.match('(#Noun|#QuestionWord) (#Copula|did|do|have|had|could|would|will)');
  m.concat(remain.match('(they|we|you|i) have'));
  m.concat(remain.match('i am'));
  m.concat(remain.match('(#Copula|#Modal|do|does|have|has|can|will) not'));
  m.list.forEach(function (ts) {
    ts.expanded = true;
  });
  return m;
};
module.exports = find;

},{}],23:[function(_dereq_,module,exports){
'use strict';

var Text = _dereq_('../../text');
var ContractionCl = _dereq_('./contraction');
var findPossible = _dereq_('./findPossible');
//the Contractions() subset class

var methods = {
  contract: function contract() {
    this.list.forEach(function (ts) {
      return ts.contract();
    });
    return this;
  },
  expand: function expand() {
    this.list.forEach(function (ts) {
      return ts.expand();
    });
    return this;
  },
  contracted: function contracted() {
    this.list = this.list.filter(function (ts) {
      return ts.contracted;
    });
    return this;
  },
  expanded: function expanded() {
    this.list = this.list.filter(function (ts) {
      return !ts.contracted;
    });
    return this;
  }
};

var find = function find(r, n) {
  //find currently-contracted
  var found = r.match('#Contraction #Contraction #Contraction?');
  found.list = found.list.map(function (ts) {
    var c = new ContractionCl(ts.terms, ts.world, ts.refText, ts.refTerms);
    c.contracted = true;
    return c;
  });
  //find currently-expanded
  var expanded = findPossible(r);
  expanded.list.forEach(function (ts) {
    var c = new ContractionCl(ts.terms, ts.world, ts.refText, ts.refTerms);
    c.contracted = false;
    found.list.push(c);
  });
  found.sort('chronological');
  //get nth element
  if (typeof n === 'number') {
    found = found.get(n);
  }
  return found;
};

module.exports = Text.makeSubset(methods, find);

},{"../../text":192,"./contraction":20,"./findPossible":22}],24:[function(_dereq_,module,exports){
'use strict';

var Terms = _dereq_('../../paths').Terms;
var parseDate = _dereq_('./parseDate');

var _Date = function _Date(arr, world, refText) {
  Terms.call(this, arr, world, refText);
  this.month = this.match('#Month');
};

//Inherit properties
_Date.prototype = Object.create(Terms.prototype);

_Date.prototype.data = function () {
  return {
    text: this.out('text'),
    normal: this.out('normal'),
    date: parseDate(this)
  };
};

module.exports = _Date;

},{"../../paths":8,"./parseDate":28}],25:[function(_dereq_,module,exports){
'use strict';

var Text = _dereq_('../../text');
var Date = _dereq_('./date');
var weekdays = _dereq_('./weekday');
var months = _dereq_('./month');
//the Dates() subset class
var methods = {
  toShortForm: function toShortForm() {
    this.match('#Month').terms().list.forEach(function (ts) {
      var t = ts.terms[0];
      months.toShortForm(t);
    });
    this.match('#WeekDay').terms().list.forEach(function (ts) {
      var t = ts.terms[0];
      weekdays.toShortForm(t);
    });
    return this;
  },
  toLongForm: function toLongForm() {
    this.match('#Month').terms().list.forEach(function (ts) {
      var t = ts.terms[0];
      months.toLongForm(t);
    });
    this.match('#WeekDay').terms().list.forEach(function (ts) {
      var t = ts.terms[0];
      weekdays.toLongForm(t);
    });
    return this;
  }
};

var find = function find(r, n) {
  var dates = r.match('#Date+');
  if (typeof n === 'number') {
    dates = dates.get(n);
  }
  dates.list = dates.list.map(function (ts) {
    return new Date(ts.terms, ts.world, ts.refText, ts.refTerms);
  });
  return dates;
};

module.exports = Text.makeSubset(methods, find);

},{"../../text":192,"./date":24,"./month":27,"./weekday":31}],26:[function(_dereq_,module,exports){
'use strict';

//follow the javascript scheme
//january is 0
exports.longMonths = {
  'january': 0,
  'february': 1,
  'march': 2,
  'april': 3,
  'may': 4,
  'june': 5,
  'july': 6,
  'august': 7,
  'september': 8,
  'october': 9,
  'november': 10,
  'december': 11
};
exports.shortMonths = {
  'jan': 0,
  'feb': 1,
  'mar': 2,
  'apr': 3,
  'may': 4,
  'jun': 5,
  'jul': 6,
  'aug': 7,
  'sep': 8,
  'oct': 9,
  'nov': 10,
  'dec': 11,
  //extra ones
  'febr': 1,
  'sept': 8
};

},{}],27:[function(_dereq_,module,exports){
'use strict';

var data = _dereq_('./data');
var shortMonths = data.shortMonths;
var longMonths = data.longMonths;
var titleCase = function titleCase(str) {
  return str.charAt(0).toUpperCase() + str.substr(1);
};
module.exports = {
  index: function index(t) {
    if (t.tags.Month) {
      if (longMonths[t.normal] !== undefined) {
        return longMonths[t.normal];
      }
      if (shortMonths[t.normal] !== undefined) {
        return shortMonths[t.normal];
      }
    }
    return null;
  },
  toShortForm: function toShortForm(t) {
    if (t.tags.Month !== undefined) {
      if (longMonths[t.normal] !== undefined) {
        var shorten = Object.keys(shortMonths);
        var punct = t.getPunctuation() || '';
        t.text = shorten[longMonths[t.normal]] + punct;
        if (t.tags.TitleCase) {
          t.text = titleCase(t.text);
        }
      }
    }
    t.dirty = true;
    return t;
  },
  toLongForm: function toLongForm(t) {
    if (t.tags.Month !== undefined) {
      if (shortMonths[t.normal] !== undefined) {
        var longer = Object.keys(longMonths);
        var punct = t.getPunctuation() || '';
        t.text = longer[shortMonths[t.normal]] + punct;
        if (t.tags.TitleCase) {
          t.text = titleCase(t.text);
        }
      }
    }
    t.dirty = true;
    return t;
  }

};

},{"./data":26}],28:[function(_dereq_,module,exports){
'use strict';

var parseTime = _dereq_('./parseTime');
var weekdays = _dereq_('./weekday');
var months = _dereq_('./month');
//a hugely-conservative and incomplete first-pass for parsing written-dates

//validate a day-of-month
var isDate = function isDate(num) {
  if (num && num < 31 && num > 0) {
    return true;
  }
  return false;
};

//please change this in one thousand years
var isYear = function isYear(num) {
  if (num && num > 1000 && num < 3000) {
    return true;
  }
  return false;
};

//
var parseDate = function parseDate(r) {
  var result = {
    month: null,
    date: null,
    weekday: null,
    year: null,
    named: null,
    time: null
  };
  var m = r.match('(#Holiday|today|tomorrow|yesterday)');
  if (m.found) {
    result.named = m.out('normal');
  }
  m = r.match('#Month');
  if (m.found) {
    result.month = months.index(m.list[0].terms[0]);
  }
  m = r.match('#WeekDay');
  if (m.found) {
    result.weekday = weekdays.index(m.list[0].terms[0]);
  }
  m = r.match('#Time');
  if (m.found) {
    result.time = parseTime(r);
    r.not('#Time'); //unsure
  }
  //january fifth 1992
  m = r.match('#Month #Value #Year');
  if (m.found) {
    var numbers = m.values().numbers();
    if (isDate(numbers[0])) {
      result.date = numbers[0];
    }
    var year = parseInt(r.match('#Year').out('normal'), 10);
    if (isYear(year)) {
      result.year = year;
    }
  }
  if (!m.found) {
    //january fifth,  january 1992
    m = r.match('#Month #Value');
    if (m.found) {
      var _numbers = m.values().numbers();
      var num = _numbers[0];
      if (isDate(num)) {
        result.date = num;
      }
    }
    //january 1992
    m = r.match('#Month #Year');
    if (m.found) {
      var _num = parseInt(r.match('#Year').out('normal'), 10);
      if (isYear(_num)) {
        result.year = _num;
      }
    }
  }

  //fifth of january
  m = r.match('#Value of #Month');
  if (m.found) {
    var _num2 = m.values().numbers()[0];
    if (isDate(_num2)) {
      result.date = _num2;
    }
  }
  return result;
};
module.exports = parseDate;

},{"./month":27,"./parseTime":29,"./weekday":31}],29:[function(_dereq_,module,exports){
'use strict';

var ampm = /([12]?[0-9]) ?(am|pm)/i;
var hourMin = /([12]?[0-9]):([0-9][0-9]) ?(am|pm)?/i;
//
var isHour = function isHour(num) {
  if (num && num > 0 && num < 25) {
    return true;
  }
  return false;
};
var isMinute = function isMinute(num) {
  if (num && num > 0 && num < 60) {
    return true;
  }
  return false;
};

var parseTime = function parseTime(r) {
  var result = {
    logic: null,
    hour: null,
    minute: null,
    second: null,
    timezone: null
  };

  var logic = r.match('(by|before|for|during|at|until|after) #Time').firstTerm();
  if (logic.found) {
    result.logic = logic.out('normal');
  }

  var time = r.match('#Time');
  time.terms().list.forEach(function (ts) {
    var t = ts.terms[0];
    //3pm
    var m = t.text.match(ampm);
    if (m !== null) {
      result.hour = parseInt(m[1], 10);
      if (m[2] === 'pm') {
        result.hour += 12;
      }
      if (isHour(result.hour) === false) {
        result.hour = null;
      }
    }
    //3:15
    m = t.text.match(hourMin);
    if (m !== null) {
      result.hour = parseInt(m[1], 10);
      result.minute = parseInt(m[2], 10);
      if (!isMinute(result.minute)) {
        result.minute = null;
      }
      if (m[3] === 'pm') {
        result.hour += 12;
      }
      if (isHour(result.hour) === false) {
        result.hour = null;
      }
    }
  });
  return result;
};
module.exports = parseTime;

},{}],30:[function(_dereq_,module,exports){
'use strict';

//follow the javascript scheme
//sunday is 0
exports.longDays = {
  'sunday': 0,
  'monday': 1,
  'tuesday': 2,
  'wednesday': 3,
  'thursday': 4,
  'friday': 5,
  'saturday': 6
};
exports.shortDays = {
  'sun': 0,
  'mon': 1,
  'tues': 2,
  'wed': 3,
  'weds': 3,
  'thurs': 4,
  'fri': 5,
  'sat': 6
};

},{}],31:[function(_dereq_,module,exports){
'use strict';

var data = _dereq_('./data');
var shortDays = data.shortDays;
var longDays = data.longDays;

module.exports = {
  index: function index(t) {
    if (t.tags.WeekDay) {
      if (longDays[t.normal] !== undefined) {
        return longDays[t.normal];
      }
      if (shortDays[t.normal] !== undefined) {
        return shortDays[t.normal];
      }
    }
    return null;
  },
  toShortForm: function toShortForm(t) {
    if (t.tags.WeekDay) {
      if (longDays[t.normal] !== undefined) {
        var shorten = Object.keys(shortDays);
        t.text = shorten[longDays[t.normal]];
      }
    }
    return t;
  },
  toLongForm: function toLongForm(t) {
    if (t.tags.WeekDay) {
      if (shortDays[t.normal] !== undefined) {
        var longer = Object.keys(longDays);
        t.text = longer[shortDays[t.normal]];
      }
    }
    return t;
  }
};

},{"./data":30}],32:[function(_dereq_,module,exports){
'use strict';

var Ngrams = _dereq_('./index');
var getGrams = _dereq_('./getGrams');

//like an n-gram, but only the endings of matches
var EndGrams = function EndGrams(arr, world, original) {
  Ngrams.call(this, arr, world, original);
};

//Inherit properties
EndGrams.prototype = Object.create(Ngrams.prototype);

//like an n-gram, but only the startings of matches
EndGrams.find = function (r, n, size) {
  var opts = {
    size: [1, 2, 3, 4],
    edge: 'end'
  };
  //only look for bigrams, for example
  if (size) {
    opts.size = [size];
  }
  //fetch them
  var arr = getGrams(r, opts);
  r = new EndGrams(arr);
  //default sort
  r.sort();
  //grab top one, or something
  if (typeof n === 'number') {
    r = r.get(n);
  }
  return r;
};
module.exports = EndGrams;

},{"./getGrams":33,"./index":35}],33:[function(_dereq_,module,exports){
'use strict';

var Gram = _dereq_('./gram');

//strip contractions - remove '' term for "it's"
var noEmpty = function noEmpty(fts) {
  return fts = fts.terms.filter(function (t) {
    return t._text !== '';
  });
};

//do all grams of one size, on one termList
var getGrams = function getGrams(fts, n) {
  var terms = noEmpty(fts);
  if (terms.length < n) {
    return [];
  }
  var arr = [];
  for (var i = 0; i < terms.length - n + 1; i++) {
    var gram = new Gram(terms.slice(i, i + n));
    arr.push(gram);
  }
  return arr;
};

//left-sided grams
var startGram = function startGram(fts, n) {
  var terms = noEmpty(fts);
  if (terms.length < n) {
    return [];
  }
  var arr = [new Gram(terms.slice(0, n))];
  return arr;
};

//right-sided grams
var endGram = function endGram(fts, n) {
  var terms = noEmpty(fts);
  if (terms.length < n) {
    return [];
  }
  var arr = [new Gram(terms.slice(terms.length - n, terms.length))];
  return arr;
};

//ngrams are consecutive terms of a specific size
var buildGrams = function buildGrams(r, options) {
  options = options || {};
  options.size = options.size || [1, 2, 3];
  if (typeof options.size === 'number') {
    options.size = [options.size];
  }
  var obj = {};
  //collect and count all grams
  options.size.forEach(function (size) {
    r.list.forEach(function (ts) {
      var newGrams = [];
      if (options.edge === 'start') {
        newGrams = startGram(ts, size);
      } else if (options.edge === 'end') {
        newGrams = endGram(ts, size);
      } else {
        newGrams = getGrams(ts, size);
      }
      newGrams.forEach(function (g) {
        if (obj.hasOwnProperty(g.key)) {
          obj[g.key].inc();
        } else {
          obj[g.key] = g;
        }
      });
    });
  });

  //flatten to an array
  var arr = Object.keys(obj).map(function (k) {
    return obj[k];
  });
  return arr;
};

module.exports = buildGrams;

},{"./gram":34}],34:[function(_dereq_,module,exports){
'use strict';

var Terms = _dereq_('../../paths').Terms;

//this is one-or-more terms together, sorted by frequency
var Gram = function Gram(arr, world, original) {
  Terms.call(this, arr, world, original);
  //string to sort/uniq by
  this.key = this.out('normal');
  //bigram/trigram/etc
  this.size = arr.length;
  //number of occurances
  this.count = 1;
};

//Inherit properties
Gram.prototype = Object.create(Terms.prototype);

Gram.prototype.inc = function () {
  this.count += 1;
};

module.exports = Gram;

},{"../../paths":8}],35:[function(_dereq_,module,exports){
'use strict';

var Text = _dereq_('../../text');
var getGrams = _dereq_('./getGrams');

var _sort = function _sort(r) {
  r.list = r.list.sort(function (a, b) {
    if (a.count > b.count) {
      return -1;
    }
    //(tie-braker)
    if (a.count === b.count && (a.size > b.size || a.key.length > b.key.length)) {
      return -1;
    }
    return 1;
  });
  return r;
};

//the Ngrams() subset class
var methods = {
  data: function data() {
    return this.list.map(function (ts) {
      return {
        normal: ts.out('normal'),
        count: ts.count,
        size: ts.size
      };
    });
  },
  unigrams: function unigrams() {
    this.list = this.list.filter(function (g) {
      return g.size === 1;
    });
    return this;
  },
  bigrams: function bigrams() {
    this.list = this.list.filter(function (g) {
      return g.size === 2;
    });
    return this;
  },
  trigrams: function trigrams() {
    this.list = this.list.filter(function (g) {
      return g.size === 3;
    });
    return this;
  },
  //default sort the ngrams
  sort: function sort() {
    return _sort(this);
  }
};

var find = function find(r, obj) {
  var sizes = [];
  //support .ngrams(3), for compat
  if (typeof obj === 'number') {
    obj = {
      n: obj
    };
  }
  obj = obj || {};
  var max = obj.max || 4;
  for (var i = 1; i <= max; i++) {
    sizes.push(i);
  }
  //only look for bigrams, for example
  if (obj.size) {
    sizes = [obj.size];
  }
  var opts = {
    size: sizes
  };
  //fetch them
  var arr = getGrams(r, opts);
  r = new Text(arr);
  //default sort
  r = _sort(r);
  //grab top one, or something
  if (obj.n !== undefined) {
    r = r.get(obj.n);
  }
  return r;
};

module.exports = Text.makeSubset(methods, find);

},{"../../text":192,"./getGrams":33}],36:[function(_dereq_,module,exports){
'use strict';

var Ngrams = _dereq_('./index');
var getGrams = _dereq_('./getGrams');

var StartGrams = function StartGrams(arr, world, original) {
  Ngrams.call(this, arr, world, original);
};

//Inherit properties
StartGrams.prototype = Object.create(Ngrams.prototype);

//like an n-gram, but only the startings of matches
StartGrams.find = function (r, n, size) {
  var opts = {
    size: [1, 2, 3, 4],
    edge: 'start'
  };
  //only look for bigrams, for example
  if (size) {
    opts.size = [size];
  }
  //fetch them
  var arr = getGrams(r, opts);
  r = new StartGrams(arr);
  //default sort
  r.sort();
  //grab top one, or something
  if (typeof n === 'number') {
    r = r.get(n);
  }
  return r;
};

module.exports = StartGrams;

},{"./getGrams":33,"./index":35}],37:[function(_dereq_,module,exports){
'use strict';

//certain words can't be plural, like 'peace'

var hasPlural = function hasPlural(t) {
  //end quick
  if (!t.tags.Noun) {
    return false;
  }
  if (t.tags.Plural) {
    return true;
  }
  //is it potentially plural?
  var noPlural = ['Pronoun', 'Place', 'Value', 'Person', 'Month', 'WeekDay', 'RelativeDay', 'Holiday'];
  for (var i = 0; i < noPlural.length; i++) {
    if (t.tags[noPlural[i]]) {
      return false;
    }
  }
  //terms known as un-inflectable, like 'peace'
  if (t.tags.Uncountable === true) {
    return false;
  }
  return true;
};

module.exports = hasPlural;

},{}],38:[function(_dereq_,module,exports){
'use strict';

var Text = _dereq_('../../text');
var Noun = _dereq_('./noun');

//the () subset class
var methods = {
  isPlural: function isPlural() {
    this.list = this.list.filter(function (ts) {
      return ts.isPlural();
    });
    return this;
  },
  hasPlural: function hasPlural() {
    return this.list.map(function (ts) {
      return ts.hasPlural();
    });
  },
  toPlural: function toPlural() {
    this.list.forEach(function (ts) {
      return ts.toPlural();
    });
    return this;
  },
  toSingular: function toSingular(verbose) {
    this.list.forEach(function (ts) {
      return ts.toSingular(verbose);
    });
    return this;
  },
  toPossessive: function toPossessive(verbose) {
    this.list.forEach(function (ts) {
      return ts.toPossessive(verbose);
    });
    return this;
  },
  articles: function articles() {
    return this.list.map(function (ts) {
      return {
        text: ts.out('text'),
        normal: ts.out('normal'),
        article: ts.article()
      };
    });
  }
};

var find = function find(r, n) {
  r = r.clauses();
  r = r.match('#Noun+ (of|by)? the? #Noun+?');
  //nouns that we don't want in these results, for weird reasons
  r = r.not('#Pronoun');
  r = r.not('(there|these)');
  r = r.not('(#Month|#WeekDay)'); //allow Durations, Holidays
  // //allow possessives like "spencer's", but not generic ones like,
  r = r.not('(my|our|your|their|her|his)');
  r = r.not('(of|for|by|the)$');
  if (typeof n === 'number') {
    r = r.get(n);
  }
  r.list = r.list.map(function (ts) {
    return new Noun(ts.terms, ts.world, ts.refText, ts.refTerms);
  });
  return r;
};

module.exports = Text.makeSubset(methods, find);

},{"../../text":192,"./noun":46}],39:[function(_dereq_,module,exports){
'use strict';

var rules = _dereq_('./methods/data/indicators');
var prep = /([a-z]*) (of|in|by|for) [a-z]/;
var hasPlural = _dereq_('./hasPlural');

var knownPlural = {
  i: false,
  he: false,
  she: false,
  we: true,
  they: true
};

//is it potentially plural?
var noPlural = ['Place', 'Value', 'Person', 'Month', 'WeekDay', 'RelativeDay', 'Holiday', 'Possessive'];
//first, try to guess based on existing tags
var couldEvenBePlural = function couldEvenBePlural(t) {
  if (hasPlural(t) === false) {
    return false;
  }
  for (var i = 0; i < noPlural.length; i++) {
    if (t.tags[noPlural[i]]) {
      return false;
    }
  }
  return true;
};

/** returns true, false, or null */
var isPlural = function isPlural(t, world) {
  if (t.tags.Plural) {
    return true;
  }
  if (t.tags.Singular) {
    return false;
  }
  var str = t.normal;
  //whitelist a few easy ones
  if (knownPlural.hasOwnProperty(str) === true) {
    return knownPlural[str];
  }
  //check given irregulars
  if (world.plurals && world.plurals.hasOwnProperty(str) === true) {
    return false;
  }
  //check opposite-ones
  if (world.cache.toSingular && world.cache.toSingular.hasOwnProperty(str) === true) {
    return true;
  }
  //inspect the existing tags to see if a plural is valid
  if (couldEvenBePlural(t) === false) {
    return null;
  }
  //handle 'mayors of chicago'
  var preposition = str.match(prep);
  if (preposition !== null) {
    str = preposition[1];
  }
  //check the suffix-type rules for indications
  for (var i = 0; i < rules.plural_indicators.length; i++) {
    if (rules.plural_indicators[i].test(str) === true) {
      return true;
    }
  }
  for (var _i = 0; _i < rules.singular_indicators.length; _i++) {
    if (rules.singular_indicators[_i].test(str) === true) {
      return false;
    }
  }
  // a fallback 'looks check plural' rule..
  if (/s$/.test(str) === true && /ss$/.test(str) === false && str.length > 3) {
    //needs some lovin'
    return true;
  }
  return false;
};

module.exports = isPlural;
// console.log(is_plural('octopus'))

},{"./hasPlural":37,"./methods/data/indicators":41}],40:[function(_dereq_,module,exports){
'use strict';

//chooses an indefinite aricle 'a/an' for a word

var irregulars = {
  'hour': 'an',
  'heir': 'an',
  'heirloom': 'an',
  'honest': 'an',
  'honour': 'an',
  'honor': 'an',
  'uber': 'an' //german u
};
//pronounced letters of acronyms that get a 'an'
var an_acronyms = {
  a: true,
  e: true,
  f: true,
  h: true,
  i: true,
  l: true,
  m: true,
  n: true,
  o: true,
  r: true,
  s: true,
  x: true
};
//'a' regexes
var a_regexs = [/^onc?e/i, //'wu' sound of 'o'
/^u[bcfhjkqrstn][aeiou]/i, // 'yu' sound for hard 'u'
/^eul/i];

var makeArticle = function makeArticle(t) {
  var str = t.normal;
  //no 'the john smith', but 'a london hotel'
  if (t.tags.Person) {
    return '';
  }
  //no a/an if it's plural
  if (t.tags.Plural) {
    return 'the';
  }
  //explicit irregular forms
  if (irregulars.hasOwnProperty(str)) {
    return irregulars[str];
  }
  //spelled-out acronyms
  var firstLetter = str.substr(0, 1);
  if (t.isAcronym() && an_acronyms.hasOwnProperty(firstLetter)) {
    return 'an';
  }
  //'a' regexes
  for (var i = 0; i < a_regexs.length; i++) {
    if (a_regexs[i].test(str)) {
      return 'a';
    }
  }
  //basic vowel-startings
  if (/^[aeiou]/i.test(str)) {
    return 'an';
  }
  return 'a';
};

module.exports = makeArticle;

},{}],41:[function(_dereq_,module,exports){
'use strict';
//similar to plural/singularize rules, but not the same

var plural_indicators = [/(^v)ies$/i, /ises$/i, /ives$/i, /(antenn|formul|nebul|vertebr|vit)ae$/i, /(octop|vir|radi|nucle|fung|cact|stimul)i$/i, /(buffal|tomat|tornad)oes$/i, /(analy|ba|diagno|parenthe|progno|synop|the)ses$/i, /(vert|ind|cort)ices$/i, /(matr|append)ices$/i, /(x|ch|ss|sh|s|z|o)es$/i, /men$/i, /news$/i, /.tia$/i, /(^f)ves$/i, /(lr)ves$/i, /(^aeiouy|qu)ies$/i, /(m|l)ice$/i, /(cris|ax|test)es$/i, /(alias|status)es$/i, /ics$/i];

//similar to plural/singularize rules, but not the same
var singular_indicators = [/(ax|test)is$/i, /(octop|vir|radi|nucle|fung|cact|stimul)us$/i, /(octop|vir)i$/i, /(rl)f$/i, /(alias|status)$/i, /(bu)s$/i, /(al|ad|at|er|et|ed|ad)o$/i, /(ti)um$/i, /(ti)a$/i, /sis$/i, /(?:(^f)fe|(lr)f)$/i, /hive$/i, /(^aeiouy|qu)y$/i, /(x|ch|ss|sh|z)$/i, /(matr|vert|ind|cort)(ix|ex)$/i, /(m|l)ouse$/i, /(m|l)ice$/i, /(antenn|formul|nebul|vertebr|vit)a$/i, /.sis$/i, /^(?!talis|.*hu)(.*)man$/i];
module.exports = {
  singular_indicators: singular_indicators,
  plural_indicators: plural_indicators
};

},{}],42:[function(_dereq_,module,exports){
'use strict';

//patterns for turning 'bus' to 'buses'
module.exports = [[/(ax|test)is$/i, '$1es'], [/(octop|vir|radi|nucle|fung|cact|stimul)us$/i, '$1i'], [/(octop|vir)i$/i, '$1i'], [/(kn|l|w)ife$/i, '$1ives'], [/^((?:ca|e|ha|(?:our|them|your)?se|she|wo)l|lea|loa|shea|thie)f$/i, '$1ves'], [/^(dwar|handkerchie|hoo|scar|whar)f$/i, '$1ves'], [/(alias|status)$/i, '$1es'], [/(bu)s$/i, '$1ses'], [/(al|ad|at|er|et|ed|ad)o$/i, '$1oes'], [/([ti])um$/i, '$1a'], [/([ti])a$/i, '$1a'], [/sis$/i, 'ses'], [/(hive)$/i, '$1s'], [/([^aeiouy]|qu)y$/i, '$1ies'], [/(x|ch|ss|sh|s|z)$/i, '$1es'], [/(matr|vert|ind|cort)(ix|ex)$/i, '$1ices'], [/([m|l])ouse$/i, '$1ice'], [/([m|l])ice$/i, '$1ice'], [/^(ox)$/i, '$1en'], [/^(oxen)$/i, '$1'], [/(quiz)$/i, '$1zes'], [/(antenn|formul|nebul|vertebr|vit)a$/i, '$1ae'], [/(sis)$/i, 'ses'], [/^(?!talis|.*hu)(.*)man$/i, '$1men'], [/(.*)/i, '$1s']].map(function (a) {
  return {
    reg: a[0],
    repl: a[1]
  };
});

},{}],43:[function(_dereq_,module,exports){
'use strict';

//patterns for turning 'dwarves' to 'dwarf'
module.exports = [[/([^v])ies$/i, '$1y'], [/ises$/i, 'isis'], [/(kn|[^o]l|w)ives$/i, '$1ife'], [/^((?:ca|e|ha|(?:our|them|your)?se|she|wo)l|lea|loa|shea|thie)ves$/i, '$1f'], [/^(dwar|handkerchie|hoo|scar|whar)ves$/i, '$1f'], [/(antenn|formul|nebul|vertebr|vit)ae$/i, '$1a'], [/(octop|vir|radi|nucle|fung|cact|stimul)(i)$/i, '$1us'], [/(buffal|tomat|tornad)(oes)$/i, '$1o'],
// [/(analy|diagno|parenthe|progno|synop|the)ses$/i, '$1sis'],
[/(..[aeiou]s)es$/i, '$1'], [/(vert|ind|cort)(ices)$/i, '$1ex'], [/(matr|append)(ices)$/i, '$1ix'], [/(x|ch|ss|sh|z|o)es$/i, '$1'], [/men$/i, 'man'], [/(n)ews$/i, '$1ews'], [/([ti])a$/i, '$1um'], [/([^aeiouy]|qu)ies$/i, '$1y'], [/(s)eries$/i, '$1eries'], [/(m)ovies$/i, '$1ovie'], [/([m|l])ice$/i, '$1ouse'], [/(cris|ax|test)es$/i, '$1is'], [/(alias|status)es$/i, '$1'], [/(ss)$/i, '$1'], [/(ics)$/i, '$1'], [/s$/i, '']].map(function (a) {
  return {
    reg: a[0],
    repl: a[1]
  };
});

},{}],44:[function(_dereq_,module,exports){
'use strict';
// const irregulars = require('../../../lexicon/uncompressed/irregularPlurals').toPlural;

var pluralRules = _dereq_('./data/pluralRules');

//turn 'shoe' into 'shoes'
var pluralize = function pluralize(str, world) {
  var irregulars = world.plurals || {};
  //irregular
  if (irregulars.hasOwnProperty(str) === true) {
    return irregulars[str];
  }
  //regular rule-based inflector
  for (var i = 0; i < pluralRules.length; i++) {
    if (pluralRules[i].reg.test(str) === true) {
      return str.replace(pluralRules[i].reg, pluralRules[i].repl);
    }
  }
  return null;
};

module.exports = pluralize;

},{"./data/pluralRules":42}],45:[function(_dereq_,module,exports){
'use strict';

var singleRules = _dereq_('./data/singleRules');

//turn 'shoes' into 'shoe'
var toSingle = function toSingle(str, world) {
  //reverse it //TODO: cache in world object somewhere
  var irregulars = world.cache.toSingular || {};
  //check irregulars
  if (irregulars.hasOwnProperty(str) === true) {
    return irregulars[str];
  }
  if (world && world.plurals) {
    //given irregulars
    var keys = Object.keys(world.plurals);
    for (var i = 0; i < keys.length; i++) {
      if (world.plurals[keys[i]] === str) {
        return keys[i];
      }
    }
  }

  //inflect first word of preposition-phrase
  if (/([a-z]*) (of|in|by|for) [a-z]/.test(str) === true) {
    var first = (str.match(/^([a-z]*) (of|in|by|for) [a-z]/) || [])[1];
    if (first) {
      var better_first = toSingle(first); //recursive
      return better_first + str.replace(first, '');
    }
  }

  //regular rule-based inflector
  for (var _i = 0; _i < singleRules.length; _i++) {
    if (singleRules[_i].reg.test(str) === true) {
      return str.replace(singleRules[_i].reg, singleRules[_i].repl);
    }
  }
  return null;
};

module.exports = toSingle;
// console.log(toSingle('days'))

},{"./data/singleRules":43}],46:[function(_dereq_,module,exports){
'use strict';

var Terms = _dereq_('../../paths').Terms;
var _hasPlural = _dereq_('./hasPlural');
var _isPlural = _dereq_('./isPlural');
var _toPossessive = _dereq_('./toPossessive');
var makeArticle = _dereq_('./makeArticle');
var pluralize = _dereq_('./methods/pluralize');
var singularize = _dereq_('./methods/singularize');

var methods = {
  article: function article() {
    return makeArticle(this.main);
  },
  isPlural: function isPlural() {
    return _isPlural(this.main, this.world);
  },
  hasPlural: function hasPlural() {
    return _hasPlural(this.main);
  },
  toPlural: function toPlural(verbose) {
    var t = this.main;
    if (_hasPlural(t) && !_isPlural(t, this.world)) {
      t.text = pluralize(t.normal, this.world, verbose) || t.text;
      t.unTag('Singular', 'toPlural');
      t.tag('Plural', 'toPlural');
    }
    return this;
  },
  toSingular: function toSingular(verbose) {
    var t = this.main;
    if (_isPlural(t, this.world)) {
      t.text = singularize(t.normal, this.world, verbose) || t.text;
      t.unTag('Plural', 'toSingular');
      t.tag('Singular', 'toSingular');
    }
    return this;
  },
  toPossessive: function toPossessive() {
    var t = this.main;
    if (t.tags.Possessive) {
      return this;
    }
    t = _toPossessive(t);
    return this;
  },
  data: function data() {
    var t = this.main;
    var singular = t.text;
    if (_isPlural(t, this.world)) {
      singular = singularize(t.normal, this.world) || t.text;
    }
    var plural = t.text;
    if (_hasPlural(t) && !_isPlural(t, this.world)) {
      plural = pluralize(t.normal, this.world) || t.text;
    }
    //support 'mayors of chicago'
    var qualifier = '';
    if (this.qualifier) {
      qualifier = this.qualifier.out('normal');
      singular += ' ' + qualifier;
      plural += ' ' + qualifier;
    }
    return {
      text: this.out('text'),
      normal: this.out('normal'),
      article: this.article(),
      main: t.normal,
      qualifier: qualifier,
      singular: singular,
      plural: plural
    };
  }
};

var Noun = function Noun(arr, world, refText) {
  Terms.call(this, arr, world, refText);
  //support 'mayor of chicago' as one noun-phrase
  this.main = this.match('[#Noun+] (of|by|for)');
  if (this.main.found) {
    this.main = this.main.list[0].terms[0];
  } else {
    this.main = this.terms[this.terms.length - 1];
  }
  //'of chicago'
  this.qualifier = this.match(this.main.normal + ' [.+]').list[0];
};
Noun.prototype = Object.create(Terms.prototype);

Object.keys(methods).forEach(function (k) {
  Noun.prototype[k] = methods[k];
});
module.exports = Noun;

},{"../../paths":8,"./hasPlural":37,"./isPlural":39,"./makeArticle":40,"./methods/pluralize":44,"./methods/singularize":45,"./toPossessive":47}],47:[function(_dereq_,module,exports){
'use strict';

var exceptions = {
  he: 'his',
  she: 'hers',
  they: 'theirs',
  we: 'ours',
  i: 'mine',
  you: 'yours',

  her: 'hers',
  their: 'theirs',
  our: 'ours',
  my: 'mine',
  your: 'yours'
};

// turn "David" to "David's"
var toPossessive = function toPossessive(t) {
  t.tag('Possessive', 'toPossessive');
  // exceptions
  if (exceptions.hasOwnProperty(t.normal)) {
    t.text = exceptions[t.normal];
    return t;
  }
  // flanders'
  if (/s$/.test(t.normal)) {
    t.text += '\'';
    return t;
  }
  //normal form:
  t.text += '\'s';
  return t;
};
module.exports = toPossessive;

},{}],48:[function(_dereq_,module,exports){
'use strict';
// make a statistical assumption about the gender of the person based on their given name
// used for pronoun resolution only.
// not intended for classification, or discrimination of people.

var gender = function gender(firstName) {
  if (!firstName) {
    return null;
  }
  //statistical guesses
  if (/.(i|ee|[a|e]y|a)$/.test(firstName) === true) {
    //this is almost-always true
    return 'Female';
  }
  if (/[ou]$/.test(firstName) === true) {
    //if it ends in a 'oh or uh', male
    return 'Male';
  }
  if (/(nn|ll|tt)/.test(firstName) === true) {
    //if it has double-consonants, female
    return 'Female';
  }
  // name not recognized, or recognized as of indeterminate gender
  return null;
};
module.exports = gender;

},{}],49:[function(_dereq_,module,exports){
'use strict';

var Text = _dereq_('../../text');
var Person = _dereq_('./person');
//this is used for pronoun and honorifics, and not intented for more-than grammatical use (see #117)

//the () subset class
var methods = {
  pronoun: function pronoun() {
    return this.list.map(function (ts) {
      return ts.pronoun();
    });
  },
  firstNames: function firstNames() {
    return this.match('#FirstName');
  },
  lastNames: function lastNames() {
    return this.match('#LastName');
  }
};

var find = function find(r, n) {
  var people = r.clauses();
  people = people.match('#Person+');
  if (typeof n === 'number') {
    people = people.get(n);
  }
  people.list = people.list.map(function (ts) {
    return new Person(ts.terms, ts.world, ts.refText, ts.refTerms);
  });
  return people;
};

module.exports = Text.makeSubset(methods, find);

},{"../../text":192,"./person":50}],50:[function(_dereq_,module,exports){
'use strict';

var Terms = _dereq_('../../paths').Terms;
var _guessGender = _dereq_('./guessGender');

var Person = function Person(arr, world, refText, refTerms) {
  Terms.call(this, arr, world, refText, refTerms);
  this.firstName = this.match('#FirstName+');
  this.middleName = this.match('#Acronym+');
  this.nickName = this.match('#NickName+');
  this.honorifics = this.match('#Honorific');
  this.lastName = this.match('#LastName+');
  //assume first-last
  if (!this.firstName.found && this.length > 1) {
    var m = this.not('(#Acronym|#Honorific)');
    this.firstName = m.first();
    this.lastName = m.last();
  }
  return this;
};
//Inherit properties
Person.prototype = Object.create(Terms.prototype);

var methods = {
  data: function data() {
    return {
      text: this.out('text'),
      normal: this.out('normal'),
      firstName: this.firstName.out('normal'),
      middleName: this.middleName.out('normal'),
      nickName: this.nickName.out('normal'),
      lastName: this.lastName.out('normal'),
      genderGuess: this.guessGender(),
      pronoun: this.pronoun(),
      honorifics: this.honorifics.out('array')
    };
  },
  guessGender: function guessGender() {
    //try known honorifics
    if (this.honorifics.match('(mr|mister|sr|sir|jr)').found) {
      return 'Male';
    }
    if (this.honorifics.match('(mrs|miss|ms|misses|mme|mlle)').found) {
      return 'Female';
    }
    //try known first-names
    if (this.firstName.match('#MaleName').found) {
      return 'Male';
    }
    if (this.firstName.match('#FemaleName').found) {
      return 'Female';
    }
    //look-for regex clues
    var str = this.firstName.out('normal');
    return _guessGender(str);
  },
  pronoun: function pronoun() {
    var str = this.firstName.out('normal');
    var g = this.guessGender(str);
    if (g === 'Male') {
      return 'he';
    }
    if (g === 'Female') {
      return 'she';
    }
    return 'they';
  },
  root: function root() {
    var first = this.firstName.out('root');
    var last = this.lastName.out('root');
    if (first && last) {
      return first + ' ' + last;
    }
    return last || first || this.out('root');
  }
};

Object.keys(methods).forEach(function (k) {
  Person.prototype[k] = methods[k];
});
module.exports = Person;

},{"../../paths":8,"./guessGender":48}],51:[function(_dereq_,module,exports){
'use strict';

var Text = _dereq_('../../text');
// const Terms = require('../../paths').Terms;

var methods = {
  //remove the 's on the end of the word
  strip: function strip() {
    this.list.forEach(function (ts) {
      var t = ts.terms[ts.terms.length - 1];
      t.text = t.text.replace(/'s$/, '');
      t.unTag('Possessive', '.strip()');
    });
    return this;
  }
};

var find = function find(r, n) {
  r = r.match('#Possessive+');
  r = r.splitAfter('#Comma');
  if (typeof n === 'number') {
    r = r.get(n);
  }
  return r;
};

module.exports = Text.makeSubset(methods, find);

},{"../../text":192}],52:[function(_dereq_,module,exports){
'use strict';

var Text = _dereq_('../../text');
var Sentence = _dereq_('./sentence');
//the Sentences() subset class
var methods = {
  /** conjugate the main/first verb*/
  toPastTense: function toPastTense() {
    this.list = this.list.map(function (ts) {
      ts = ts.toPastTense();
      return new Sentence(ts.terms, ts.world, ts.refText, ts.refTerms);
    });
    return this;
  },
  toPresentTense: function toPresentTense() {
    this.list = this.list.map(function (ts) {
      ts = ts.toPresentTense();
      return new Sentence(ts.terms, ts.world, ts.refText, ts.refTerms);
    });
    return this;
  },
  toFutureTense: function toFutureTense() {
    this.list = this.list.map(function (ts) {
      ts = ts.toFutureTense();
      return new Sentence(ts.terms, ts.world, ts.refText, ts.refTerms);
    });
    return this;
  },
  toContinuous: function toContinuous() {
    this.list = this.list.map(function (ts) {
      ts = ts.toContinuous();
      return new Sentence(ts.terms, ts.world, ts.refText, ts.refTerms);
    });
    return this;
  },
  /** negative/positive */
  toNegative: function toNegative() {
    this.list = this.list.map(function (ts) {
      ts = ts.toNegative();
      return new Sentence(ts.terms, ts.world, ts.refText, ts.refTerms);
    });
    return this;
  },
  toPositive: function toPositive() {
    this.list = this.list.map(function (ts) {
      ts = ts.toPositive();
      return new Sentence(ts.terms, ts.world, ts.refText, ts.refTerms);
    });
    return this;
  },

  /** look for 'was _ by' patterns */
  isPassive: function isPassive() {
    this.list = this.list.filter(function (ts) {
      return ts.isPassive();
    });
    return this;
  },
  //return only questions
  isQuestion: function isQuestion() {
    // this.list = this.list.filter(ts => {
    //   return ts.isQuestion();
    // });
    return this.questions();
  },
  /** add a word to the start */
  prepend: function prepend(str) {
    this.list = this.list.map(function (ts) {
      return ts.prepend(str);
    });
    return this;
  },
  /** add a word to the end */
  append: function append(str) {
    this.list = this.list.map(function (ts) {
      return ts.append(str);
    });
    return this;
  },

  /** convert between question/statement/exclamation*/
  toExclamation: function toExclamation() {
    this.list.forEach(function (ts) {
      ts.setPunctuation('!');
    });
    return this;
  },
  toQuestion: function toQuestion() {
    this.list.forEach(function (ts) {
      ts.setPunctuation('?');
    });
    return this;
  },
  toStatement: function toStatement() {
    this.list.forEach(function (ts) {
      ts.setPunctuation('.');
    });
    return this;
  }
};

var find = function find(r, n) {
  r = r.all();
  if (typeof n === 'number') {
    r = r.get(n);
  }
  r.list = r.list.map(function (ts) {
    return new Sentence(ts.terms, ts.world, ts.refText, ts.refTerms);
  });
  return r;
};

module.exports = Text.makeSubset(methods, find);

},{"../../text":192,"./sentence":54}],53:[function(_dereq_,module,exports){
'use strict';

//is this sentence asking a question?

var isQuestion = function isQuestion(ts) {
  var endPunct = ts.getPunctuation();
  var clauses = ts.match('*').splitAfter('#Comma');

  switch (true) {
    // If it has a question mark
    // e.g., Is this the real life!?
    case /\?/.test(endPunct) === true:
      return true;

    // Has ellipsis at the end means it's probably not a question
    // e.g., Is this just fantasy...
    case /\.\.$/.test(ts.out('text')):
      return false;

    // Starts with question word, but has a comma, so probably not a question
    // e.g., Why are we caught in a land slide, no escape from reality
    case ts.has('^#QuestionWord') && ts.has('#Comma'):
      return false;

    // Starts with a #QuestionWord
    // e.g., What open your eyes look up to the skies and see
    case ts.has('^#QuestionWord'):
      return true;

    // Second word is a #QuestionWord
    // e.g., I'm what a poor boy
    // case ts.has('^\w+\s#QuestionWord'):
    // return true;

    // is it, do you - start of sentence
    // e.g., Do I need no sympathy
    case ts.has('^(do|does|did|is|was|can|could|will|would|may) #Noun'):
      return true;

    // these are a little more loose..
    // e.g., Must I be come easy come easy go
    case ts.has('^(have|must) you'):
      return true;

    // Clause starts with a question word
    // e.g., Anyway the wind blows, what doesn't really matter to me
    case clauses.has('^#QuestionWord'):
      return true;

    //is wayne gretskzy alive
    case clauses.has('(do|does|is|was) #Noun+ #Adverb? (#Adjective|#Infinitive)$'):
      return true;

    // Probably not a question
    default:
      return false;
  }
};
module.exports = isQuestion;

},{}],54:[function(_dereq_,module,exports){
'use strict';

var Terms = _dereq_('../../paths').Terms;
var _toNegative = _dereq_('./toNegative');
var _toPositive = _dereq_('./toPositive');
var Verb = _dereq_('../verbs/verb');
var insert = _dereq_('./smartInsert');

//decide on main subject-verb-object
var parse = function parse(s) {
  //strip conditions first
  var conditions = s.match('#Condition');
  var tmp = s.not('#Condition');
  //choose the verb first
  var verb = tmp.match('#VerbPhrase+').first(); //this should be much smarter
  var vb = verb.out('normal');
  //get subj noun left-of the verb
  var subject = tmp.match('#Determiner? #Adjective+? #Noun ' + vb).first().not('#VerbPhrase');
  //get obj noun right-of the verb
  var object = tmp.match(vb + ' #Preposition? #Determiner? #Noun').first().not('#VerbPhrase');
  s.conditions = conditions;
  s.subject = subject;
  s.verb = verb;
  s.object = object;
  if (s.verb.found) {
    s.verb = new Verb(s.verb.list[0].terms, s.world, s.refText, s.refTerms);
  }
  return s;
};

var fixContraction = function fixContraction(contr) {
  if (contr.found) {
    contr.contractions().expand();
  }
};

var killContraction = function killContraction(s) {
  s.terms = s.terms.filter(function (t) {
    if (t.silent_term) {
      if (t.silent_term === 'am' || t.silent_term === 'will' || t.silent_term === 'did') {
        return false;
      }
      t.text = t.silent_term;
      t.silent_term = null;
      t.unTag('Contraction');
      if (t.tags.TitleCase === true) {
        t.toTitleCase();
      }
    }
    return true;
  });
};

//if the subject of thr sentence is plural, use infinitive form of verb
// (he goes / i go)
var useInfinitive = function useInfinitive(s) {
  if (s.subject.found && s.subject.has('(i|we)')) {
    return true;
  }
  return false;
};

var methods = {
  /** inflect the main/first noun*/
  toSingular: function toSingular() {
    var nouns = this.match('#Noun').match('!#Pronoun').firstTerm();
    nouns.things().toSingular();
    return this;
  },
  toPlural: function toPlural() {
    var nouns = this.match('#Noun').match('!#Pronoun').firstTerm();
    nouns.things().toPlural();
    return this;
  },

  /** find the first important verbPhrase. returns a Term object */
  mainVerb: function mainVerb() {
    parse(this); //re-parse
    if (this.verb.found) {
      return this.verb;
    }
    return null;
  },

  /** sentence tense conversion**/
  toPastTense: function toPastTense() {
    var verb = this.mainVerb();
    if (verb) {
      //this is really ugly..
      var start = verb.out('root');
      verb.toPastTense();
      //support "i'm going"
      var contr = this.match('#Contraction ' + start);
      fixContraction(contr);
      var end = verb.out('root');
      // this.replace(start, end)
      var r = this.parentTerms.replace(start, end);
      return r;
    }
    return this;
  },
  toPresentTense: function toPresentTense() {
    var verb = this.mainVerb();
    if (verb) {
      var start = verb.out('normal');
      //plural/singular stuff
      if (useInfinitive(this) === true) {
        if (this.has('(am|will|did) ' + start)) {
          killContraction(this);
        }
        verb.toInfinitive();
        //irregular "i am"
        // this.debug();
        // if (this.has('i #Adverb? is')) {
        //   this.replace(' #Adverb? [is]', 'am');
        // }
      } else {
        verb.toPresentTense();
        var contr = this.match('#Contraction ' + start);
        fixContraction(contr);
      }
      //support "i'm going"
      var end = verb.out('normal');
      return this.parentTerms.replace(start, end);
    }
    return this;
  },
  toFutureTense: function toFutureTense() {
    var verb = this.mainVerb();
    if (verb) {
      var start = verb.clone(); //.out('root');
      verb.toFutureTense();
      //support "i'm going"
      var contr = this.match('#Contraction ' + start.out('normal'));
      fixContraction(contr);
      var end = verb.out('normal');
      return this.parentTerms.replace(start, end);
    }
    return this;
  },
  toContinuous: function toContinuous() {
    var verb = this.mainVerb();
    if (verb) {
      var start = verb.clone(); //.out('root');
      //'is walking' or 'are walking'?
      // let aux = 'is';
      // if (useInfinitive(this)) {
      //   aux = 'are';
      // }
      verb.toGerund();
      // verb.insertBefore(aux);
      //support "i'm going"
      var contr = this.match('#Contraction ' + start.out('normal'));
      fixContraction(contr);
      var end = verb.out('normal');
      return this.parentTerms.replace(start, end);
    }
    return this;
  },

  /** negation **/
  isNegative: function isNegative() {
    return this.match('#Negative').list.length === 1;
  },
  toNegative: function toNegative() {
    if (this.isNegative()) {
      return this;
    }
    return _toNegative(this);
  },
  toPositive: function toPositive() {
    if (!this.isNegative()) {
      return this;
    }
    return _toPositive(this);
  },

  /** smarter insert methods*/
  append: function append(str) {
    return insert.append(this, str);
  },
  prepend: function prepend(str) {
    return insert.prepend(this, str);
  },

  /** look for 'was _ by' patterns */
  isPassive: function isPassive() {
    return this.match('was #Adverb? #PastTense #Adverb? by').found; //haha
  }
};

var Sentence = function Sentence(arr, world, refText, refTerms) {
  Terms.call(this, arr, world, refText, refTerms);
  parse(this);
};
//Terms inheritence
Sentence.prototype = Object.create(Terms.prototype);
//add-in methods
Object.keys(methods).forEach(function (k) {
  Sentence.prototype[k] = methods[k];
});
module.exports = Sentence;

},{"../../paths":8,"../verbs/verb":94,"./smartInsert":55,"./toNegative":56,"./toPositive":57}],55:[function(_dereq_,module,exports){
'use strict';

var hasCapital = /^[A-Z]/;

//sticking words at the start sentence-sensitive
var prepend = function prepend(ts, str) {
  var firstTerm = ts.terms[0];
  ts.insertAt(0, str);
  //handle titlecase of first-word
  if (hasCapital.test(firstTerm.text)) {
    //is it titlecased because it should be?
    if (firstTerm.needsTitleCase() === false) {
      firstTerm.toLowerCase();
    }
    var newTerm = ts.terms[0];
    newTerm.toTitleCase();
  }
  return ts;
};

//sticking words on end sentence-sensitive
var append = function append(ts, str) {
  var endTerm = ts.terms[ts.terms.length - 1];
  //move the sentence punctuation to the end
  var punct = ts.getPunctuation();
  if (punct) {
    endTerm.killPunctuation();
  }
  ts.insertAt(ts.terms.length, str);
  var newTerm = ts.terms[ts.terms.length - 1];
  if (punct) {
    newTerm.text += punct;
  }
  //move over sentence-ending whitespace too
  if (endTerm.whitespace.after) {
    newTerm.whitespace.after = endTerm.whitespace.after;
    endTerm.whitespace.after = '';
  }
  return ts;
};

module.exports = {
  append: append,
  prepend: prepend
};

},{}],56:[function(_dereq_,module,exports){
'use strict';

//these terms are nicer ways to negate a sentence
//ie. john always walks -> john always doesn't walk

var logicalNegate = {
  everyone: 'no one',
  everybody: 'nobody',
  someone: 'no one',
  somebody: 'nobody',
  // everything:"nothing",
  always: 'never'
};

//different rule for i/we/they/you + infinitive
//that is, 'i walk' -> 'i don\'t walk', not 'I not walk'
var toNegative = function toNegative(ts) {
  var lg = ts.match('(everyone|everybody|someone|somebody|always)').first();
  if (lg.found && logicalNegate[lg.out('normal')]) {
    var found = lg.out('normal');
    // ts = ts.replace(found, logicalNegate[found]);
    ts = ts.match(found).replaceWith(logicalNegate[found]).list[0];
    return ts.parentTerms;
  }
  //negate the main verb of the sentence
  var vb = ts.mainVerb();
  if (vb) {
    vb.toNegative();
  }
  return ts;
};
module.exports = toNegative;

},{}],57:[function(_dereq_,module,exports){
'use strict';

//ie. john never walks -> john always walks
//nobody/noone are ambiguous logically (somebody? / everybody?)

var logical = {
  'never': 'always',
  'nothing': 'everything'
};

var toPositive = function toPositive(ts) {
  var m = ts.match('(never|nothing)').first();
  if (m.found) {
    var str = m.out('normal');
    if (logical[str]) {
      ts = ts.match(str).replaceWith(logical[str], true).list[0];
      return ts.parentTerms;
    }
  }
  //otherwise just remove 'not'
  ts.delete('#Negative');
  return ts;
};
module.exports = toPositive;

},{}],58:[function(_dereq_,module,exports){
'use strict';

var Text = _dereq_('../../text');
var Terms = _dereq_('../../paths').Terms;

//the Terms() subset class
//this is just a wrapper around the actual Term class,
//which is buried in `ts.terms[0]`
var methods = {
  data: function data() {
    return this.list.map(function (ts) {
      var t = ts.terms[0];
      return {
        spaceBefore: t.whitespace.before,
        text: t.text,
        spaceAfter: t.whitespace.after,
        normal: t.normal,
        implicit: t.silent_term,
        bestTag: t.bestTag(),
        tags: Object.keys(t.tags)
      };
    });
  }
};

var find = function find(r, n) {
  var list = [];
  //make a Terms Object for every Term
  r.list.forEach(function (ts) {
    ts.terms.forEach(function (t) {
      list.push(new Terms([t], ts.world, r));
    });
  });
  r = new Text(list, r.world, r.parent);
  if (typeof n === 'number') {
    r = r.get(n);
  }
  return r;
};

module.exports = Text.makeSubset(methods, find);

},{"../../paths":8,"../../text":192}],59:[function(_dereq_,module,exports){
'use strict';

var numOrdinal = _dereq_('./numOrdinal');
var _textOrdinal = _dereq_('./textOrdinal');
var textCardinal = _dereq_('./textCardinal');
var niceNumber = _dereq_('./niceNumber');

//make all the number formats
var fmt = {
  nice: function nice(num) {
    return niceNumber(num);
  },
  ordinal: function ordinal(num) {
    return numOrdinal(num);
  },
  cardinal: function cardinal(num) {
    return String(num);
  },
  niceOrdinal: function niceOrdinal(num) {
    num = numOrdinal(num);
    num = niceNumber(num);
    return num;
  },
  text: function text(num) {
    return textCardinal(num).join(' ');
  },
  textOrdinal: function textOrdinal(num) {
    return _textOrdinal(num);
  }
};
module.exports = fmt;

},{"./niceNumber":60,"./numOrdinal":61,"./textCardinal":62,"./textOrdinal":63}],60:[function(_dereq_,module,exports){
'use strict';
//put a comma or two in

var niceNumber = function niceNumber(num) {
  if (!num && num !== 0) {
    return null;
  }
  num = String(num);
  var x = num.split('.');
  var x1 = x[0];
  var x2 = x.length > 1 ? '.' + x[1] : '';
  var rgx = /(\d+)(\d{3})/;
  while (rgx.test(x1)) {
    x1 = x1.replace(rgx, '$1' + ',' + '$2');
  }
  return x1 + x2;
};
module.exports = niceNumber;

},{}],61:[function(_dereq_,module,exports){
'use strict';

var toString = _dereq_('./toString');

//turn a number like 5 into an ordinal like 5th
var numOrdinal = function numOrdinal(num) {
  if (!num && num !== 0) {
    return null;
  }
  //the teens are all 'th'
  var tens = num % 100;
  if (tens > 10 && tens < 20) {
    return String(num) + 'th';
  }
  //the rest of 'em
  var mapping = {
    0: 'th',
    1: 'st',
    2: 'nd',
    3: 'rd'
  };
  var str = toString(num);
  var last = str.slice(str.length - 1, str.length);
  if (mapping[last]) {
    str += mapping[last];
  } else {
    str += 'th';
  }
  return str;
};

module.exports = numOrdinal;

},{"./toString":64}],62:[function(_dereq_,module,exports){
'use strict';

var toString = _dereq_('./toString');

// turns an integer/float into a textual number, like 'fifty-five'
var tens_mapping = [['ninety', 90], ['eighty', 80], ['seventy', 70], ['sixty', 60], ['fifty', 50], ['forty', 40], ['thirty', 30], ['twenty', 20]];
var ones_mapping = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];

var sequence = [[1e24, 'septillion'], [1e21, 'sextillion'], [1e18, 'quintillion'], [1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e8, 'hundred million'], [1e6, 'million'], [100000, 'hundred thousand'], [1000, 'thousand'], [100, 'hundred'], [1, 'one']];

//turn number into an array of magnitudes, like [[5, million], [2, hundred]]
var breakdown_magnitudes = function breakdown_magnitudes(num) {
  var working = num;
  var have = [];
  sequence.forEach(function (a) {
    if (num >= a[0]) {
      var howmany = Math.floor(working / a[0]);
      working -= howmany * a[0];
      if (howmany) {
        have.push({
          unit: a[1],
          count: howmany
        });
      }
    }
  });
  return have;
};

//turn numbers from 100-0 into their text
var breakdown_hundred = function breakdown_hundred(num) {
  var arr = [];
  if (num > 100) {
    return arr; //something bad happened..
  }
  for (var i = 0; i < tens_mapping.length; i++) {
    if (num >= tens_mapping[i][1]) {
      num -= tens_mapping[i][1];
      arr.push(tens_mapping[i][0]);
    }
  }
  //(hopefully) we should only have 20-0 now
  if (ones_mapping[num]) {
    arr.push(ones_mapping[num]);
  }
  return arr;
};

/** print-out 'point eight nine'*/
var handle_decimal = function handle_decimal(num) {
  var names = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  var arr = [];
  //parse it out like a string, because js math is such shit
  var str = toString(num);
  var decimal = str.match(/\.([0-9]+)/);
  if (!decimal || !decimal[0]) {
    return arr;
  }
  arr.push('point');
  var decimals = decimal[0].split('');
  for (var i = 0; i < decimals.length; i++) {
    arr.push(names[decimals[i]]);
  }
  return arr;
};

/** turns an integer into a textual number */
var to_text = function to_text(num) {
  //big numbers, north of sextillion, aren't gonna work well..
  //keep them small..
  if (num > 1e21) {
    return [String(num)];
  }
  var arr = [];
  //handle negative numbers
  if (num < 0) {
    arr.push('negative');
    num = Math.abs(num);
  }
  //break-down into units, counts
  var units = breakdown_magnitudes(num);
  //build-up the string from its components
  for (var i = 0; i < units.length; i++) {
    var unit_name = units[i].unit;
    if (unit_name === 'one') {
      unit_name = '';
      //put an 'and' in here
      if (arr.length > 1) {
        arr.push('and');
      }
    }
    arr = arr.concat(breakdown_hundred(units[i].count));
    arr.push(unit_name);
  }
  //also support decimals - 'point eight'
  arr = arr.concat(handle_decimal(num));
  //remove empties
  arr = arr.filter(function (s) {
    return s;
  });
  if (arr.length === 0) {
    arr[0] = '';
  }
  return arr;
};

module.exports = to_text;

// console.log(to_text(-1000.8));

},{"./toString":64}],63:[function(_dereq_,module,exports){
'use strict';

var textValue = _dereq_('./textCardinal');
var ordinalWord = _dereq_('../../../world/more-data/numbers').toOrdinal;
//
var textOrdinal = function textOrdinal(num) {
  var words = textValue(num);
  //convert the last number to an ordinal
  var last = words[words.length - 1];
  words[words.length - 1] = ordinalWord[last] || last;
  return words.join(' ');
};

module.exports = textOrdinal;

},{"../../../world/more-data/numbers":220,"./textCardinal":62}],64:[function(_dereq_,module,exports){
'use strict';

//turn big numbers, like 2.3e+22, into a tonne of 0's
var numToString = function numToString(n) {
  if (n < 1000000) {
    return String(n);
  }
  var str = n.toFixed(0);
  if (str.indexOf('e+') === -1) {
    return str;
  }
  return str.replace('.', '').split('e+').reduce(function (p, b) {
    return p + Array(b - p.length + 2).join(0);
  });
};
module.exports = numToString;
// console.log(numToString(2.5e+22));

},{}],65:[function(_dereq_,module,exports){
'use strict';

var Text = _dereq_('../../text');
var Value = _dereq_('./value');
var parse = _dereq_('./parse');

//the Values() subset class
var methods = {
  noDates: function noDates() {
    return this.not('#Date');
  },
  noUnits: function noUnits() {
    return this.not('#Unit');
  },
  units: function units() {
    return this.match('#Unit+');
  },
  /** five -> 5 */
  numbers: function numbers() {
    return this.list.map(function (ts) {
      return ts.number();
    });
  },
  /** five -> '5' */
  toNumber: function toNumber() {
    this.list = this.list.map(function (ts) {
      return ts.toNumber();
    });
    return this;
  },
  /**5 -> 'five' */
  toText: function toText() {
    this.list = this.list.map(function (ts) {
      return ts.toText();
    });
    return this;
  },
  /**5th -> 5 */
  toCardinal: function toCardinal() {
    this.list = this.list.map(function (ts) {
      return ts.toCardinal();
    });
    return this;
  },
  /**5 -> 5th */
  toOrdinal: function toOrdinal() {
    this.list = this.list.map(function (ts) {
      return ts.toOrdinal();
    });
    return this;
  },
  /**5900 -> 5,900 */
  toNice: function toNice() {
    this.list = this.list.map(function (ts) {
      return ts.toNice();
    });
    return this;
  },
  /**seven === 7th */
  isEqual: function isEqual(num) {
    num = parse(num);
    this.list = this.list.filter(function (ts) {
      return num !== null && ts.number() === num;
    });
    return this;
  },
  /**eight > 7th */
  greaterThan: function greaterThan(num) {
    num = parse(num);
    this.list = this.list.filter(function (ts) {
      return num !== null && ts.number() > num;
    });
    return this;
  },
  /**five < 7th */
  lessThan: function lessThan(num) {
    num = parse(num);
    this.list = this.list.filter(function (ts) {
      return num !== null && ts.number() < num;
    });
    return this;
  },
  between: function between(min, max) {
    if (min === undefined || max === undefined) {
      return this;
    }
    min = parse(min);
    max = parse(max);
    this.list = this.list.filter(function (ts) {
      var n = ts.number();
      return n > min && n < max;
    });
    return this;
  },
  /**seven + 2 = 'nine' */
  add: function add(n) {
    this.list = this.list.map(function (ts) {
      return ts.add(n);
    });
    return this;
  },
  /**seven - 2 = 'five' */
  subtract: function subtract(n) {
    this.list = this.list.map(function (ts) {
      return ts.subtract(n);
    });
    return this;
  },
  /**seven -> 'eight' */
  increment: function increment() {
    this.list = this.list.map(function (ts) {
      return ts.add(1);
    });
    return this;
  },
  /**seven -> 'eight' */
  decrement: function decrement() {
    this.list = this.list.map(function (ts) {
      return ts.subtract(1);
    });
    return this;
  }
};

var find = function find(r, n) {
  var tens = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|fourty';
  var teens = 'eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen';
  r = r.match('#Value+ #Unit?');
  // r = r.match('#Value+ #Unit?');

  //"50 83"
  if (r.has('#NumericValue #NumericValue')) {
    //a comma may mean two numbers
    if (r.has('#Value #Comma #Value')) {
      r.splitAfter('#Comma');
    } else {
      r.splitAfter('#NumericValue');
    }
  }
  //three-length
  if (r.has('#Value #Value #Value') && !r.has('#Multiple')) {
    //twenty-five-twenty
    if (r.has('(' + tens + ') #Cardinal #Cardinal')) {
      r.splitAfter('(' + tens + ') #Cardinal');
    }
  }

  //two-length ones
  if (r.has('#Value #Value')) {
    //june 21st 1992 is two seperate values
    if (r.has('#NumericValue #NumericValue')) {
      r.splitOn('#Year');
    }
    //sixty fifteen
    if (r.has('(' + tens + ') (' + teens + ')')) {
      r.splitAfter('(' + tens + ')');
    }
    //"72 82"
    var double = r.match('#Cardinal #Cardinal');
    if (double.found && !r.has('(point|decimal)')) {
      //not 'two hundred'
      if (!double.has('#Cardinal (#Multiple|point|decimal)')) {
        //one proper way, 'twenty one', or 'hundred one'
        if (!double.has('(' + tens + ') #Cardinal') && !double.has('#Multiple #Value')) {
          r.splitAfter(double.terms(0).out('normal'));
        }
      }
    }
    //seventh fifth
    if (r.match('#Ordinal #Ordinal').match('#TextValue').found && !r.has('#Multiple')) {
      //the one proper way, 'twenty first'
      if (!r.has('(' + tens + ') #Ordinal')) {
        r.splitAfter('#Ordinal');
      }
    }
    //fifth five
    if (r.has('#Ordinal #Cardinal')) {
      r.splitBefore('#Cardinal+');
    }
    //five 2017 (support '5 hundred', and 'twenty 5'
    if (r.has('#TextValue #NumericValue') && !r.has('(' + tens + '|#Multiple)')) {
      r.splitBefore('#NumericValue+');
    }
  }
  //5-8
  if (r.has('#NumberRange')) {
    r.splitAfter('#NumberRange');
  }
  if (typeof n === 'number') {
    r = r.get(n);
  }
  var world = r.world();
  r.list = r.list.map(function (ts) {
    return new Value(ts.terms, world, ts.refText, ts.refTerms);
  });
  return r;
};

module.exports = Text.makeSubset(methods, find);

},{"../../text":192,"./parse":66,"./value":74}],66:[function(_dereq_,module,exports){
'use strict';

var parseText = _dereq_('./parseText');
// 2.5, $5.50, 3,432, etc -
var numeric = /^-?(\$|€|¥|£)?\.?[0-9]+[0-9,\.]*(st|nd|rd|th|rth|%)?$/;

var parseString = function parseString(str) {
  if (numeric.test(str) === true) {
    //clean up a number, like '$4,342.00'
    str = str.replace(/,/g, '');
    str = str.replace(/^[\$|€|¥|£]/g, '');
    str = str.replace(/%$/, '');
    str = str.replace(/(st|nd|rd|th|rth)$/g, '');
    var num = parseFloat(str);
    if (num || num === 0) {
      return num;
    }
  }
  return parseText(str);
};

//turn it all into a number
var parse = function parse(val) {
  if (val === null || val === undefined || typeof val === 'number') {
    return val;
  }
  if (typeof val === 'string') {
    return parseString(val);
  }
  //numerical values can only be one term
  if (val.terms.length === 1 && val.terms[0].tags.TextValue !== true) {
    var str = val.terms[0].normal;
    return parseString(str);
  }
  return parseText(val.out('normal'));
};
module.exports = parse;

},{"./parseText":69}],67:[function(_dereq_,module,exports){
'use strict';

var numbers = _dereq_('../../../world/more-data/numbers');
var fns = _dereq_('../paths').fns;

//setup number-word data
var ones = fns.extend(numbers.ordinal.ones, numbers.cardinal.ones);
var teens = fns.extend(numbers.ordinal.teens, numbers.cardinal.teens);
var tens = fns.extend(numbers.ordinal.tens, numbers.cardinal.tens);
var multiples = fns.extend(numbers.ordinal.multiples, numbers.cardinal.multiples);

//add this one
multiples.grand = 1000;

module.exports = {
  ones: ones,
  teens: teens,
  tens: tens,
  multiples: multiples
};

},{"../../../world/more-data/numbers":220,"../paths":73}],68:[function(_dereq_,module,exports){
'use strict';

//support global multipliers, like 'half-million' by doing 'million' then multiplying by 0.5

var findModifiers = function findModifiers(str) {
  var mults = [{
    reg: /^(minus|negative)[\s\-]/i,
    mult: -1
  }, {
    reg: /^(a\s)?half[\s\-](of\s)?/i,
    mult: 0.5
    //  {
    //   reg: /^(a\s)?quarter[\s\-]/i,
    //   mult: 0.25
    // }
  }];
  for (var i = 0; i < mults.length; i++) {
    if (mults[i].reg.test(str) === true) {
      return {
        amount: mults[i].mult,
        str: str.replace(mults[i].reg, '')
      };
    }
  }
  return {
    amount: 1,
    str: str
  };
};

module.exports = findModifiers;

},{}],69:[function(_dereq_,module,exports){
'use strict';

var findModifiers = _dereq_('./findModifiers');
var words = _dereq_('./data');
var isValid = _dereq_('./validate');
var parseDecimals = _dereq_('./parseDecimals');
var parseNumeric = _dereq_('./parseNumeric');
var improperFraction = /^([0-9,\. ]+)\/([0-9,\. ]+)$/;

//some numbers we know
var casualForms = {
  // 'a few': 3,
  'a couple': 2,
  'a dozen': 12,
  'two dozen': 24,
  zero: 0
};

// a 'section' is something like 'fifty-nine thousand'
// turn a section into something we can add to - like 59000
var section_sum = function section_sum(obj) {
  return Object.keys(obj).reduce(function (sum, k) {
    sum += obj[k];
    return sum;
  }, 0);
};

//turn a string into a number
var parse = function parse(str) {
  //convert some known-numbers
  if (casualForms.hasOwnProperty(str) === true) {
    return casualForms[str];
  }
  //'a/an' is 1
  if (str === 'a' || str === 'an') {
    return 1;
  }
  var modifier = findModifiers(str);
  str = modifier.str;
  var last_mult = null;
  var has = {};
  var sum = 0;
  var isNegative = false;
  var terms = str.split(/[ -]/);
  for (var i = 0; i < terms.length; i++) {
    var w = terms[i];
    w = parseNumeric(w);
    if (!w || w === 'and') {
      continue;
    }
    if (w === '-' || w === 'negative') {
      isNegative = true;
      continue;
    }
    if (w.charAt(0) === '-') {
      isNegative = true;
      w = w.substr(1);
    }
    //decimal mode
    if (w === 'point') {
      sum += section_sum(has);
      sum += parseDecimals(terms.slice(i + 1, terms.length));
      sum *= modifier.amount;
      return sum;
    }
    //improper fraction
    var fm = w.match(improperFraction);
    if (fm) {
      var num = parseFloat(fm[1].replace(/[, ]/g, ''));
      var denom = parseFloat(fm[2].replace(/[, ]/g, ''));
      if (denom) {
        sum += num / denom || 0;
      }
      continue;
    }
    //prevent mismatched units, like 'seven eleven'
    if (isValid(w, has) === false) {
      return null;
    }
    //buildOut section, collect 'has' values
    if (/^[0-9\.]+$/.test(w)) {
      has['ones'] = parseFloat(w); //not technically right
    } else if (words.ones.hasOwnProperty(w) === true) {
      has['ones'] = words.ones[w];
    } else if (words.teens.hasOwnProperty(w) === true) {
      has['teens'] = words.teens[w];
    } else if (words.tens.hasOwnProperty(w) === true) {
      has['tens'] = words.tens[w];
    } else if (words.multiples.hasOwnProperty(w) === true) {
      var mult = words.multiples[w];

      //something has gone wrong : 'two hundred five hundred'
      if (mult === last_mult) {
        return null;
      }
      //support 'hundred thousand'
      //this one is tricky..
      if (mult === 100 && terms[i + 1] !== undefined) {
        // has['hundreds']=
        var w2 = terms[i + 1];
        if (words.multiples[w2]) {
          mult *= words.multiples[w2]; //hundredThousand/hundredMillion
          i += 1;
        }
      }
      //natural order of things
      //five thousand, one hundred..
      if (last_mult === null || mult < last_mult) {
        sum += (section_sum(has) || 1) * mult;
        last_mult = mult;
        has = {};
      } else {
        //maybe hundred .. thousand
        sum += section_sum(has);
        last_mult = mult;
        sum = (sum || 1) * mult;
        has = {};
      }
    }
  }
  //dump the remaining has values
  sum += section_sum(has);
  //post-process add modifier
  sum *= modifier.amount;
  sum *= isNegative ? -1 : 1;
  //dont return 0, if it went straight-through
  if (sum === 0 && Object.keys(has).length === 0) {
    return null;
  }
  return sum;
};

module.exports = parse;

},{"./data":67,"./findModifiers":68,"./parseDecimals":70,"./parseNumeric":71,"./validate":72}],70:[function(_dereq_,module,exports){
'use strict';

var words = _dereq_('./data');

//concatenate into a string with leading '0.'
var parseDecimals = function parseDecimals(arr) {
  var str = '0.';
  for (var i = 0; i < arr.length; i++) {
    var w = arr[i];
    if (words.ones.hasOwnProperty(w) === true) {
      str += words.ones[w];
    } else if (words.teens.hasOwnProperty(w) === true) {
      str += words.teens[w];
    } else if (words.tens.hasOwnProperty(w) === true) {
      str += words.tens[w];
    } else if (/^[0-9]$/.test(w) === true) {
      str += w;
    } else {
      return 0;
    }
  }
  return parseFloat(str);
};

module.exports = parseDecimals;

},{"./data":67}],71:[function(_dereq_,module,exports){
'use strict';
//parse a string like "4,200.1" into Number 4200.1

var parseNumeric = function parseNumeric(str) {
  //remove ordinal - 'th/rd'
  str = str.replace(/1st$/, '1');
  str = str.replace(/2nd$/, '2');
  str = str.replace(/3rd$/, '3');
  str = str.replace(/([4567890])r?th$/, '$1');
  //remove prefixes
  str = str.replace(/^[$€¥£¢]/, '');
  //remove suffixes
  str = str.replace(/[%$€¥£¢]$/, '');
  //remove commas
  str = str.replace(/,/g, '');
  //split '5kg' from '5'
  str = str.replace(/([0-9])([a-z]{1,2})$/, '$1');
  return str;
};

module.exports = parseNumeric;

},{}],72:[function(_dereq_,module,exports){
'use strict';

var words = _dereq_('./data');

//prevent things like 'fifteen ten', and 'five sixty'
var isValid = function isValid(w, has) {
  if (words.ones.hasOwnProperty(w)) {
    if (has.ones || has.teens) {
      return false;
    }
  } else if (words.teens.hasOwnProperty(w)) {
    if (has.ones || has.teens || has.tens) {
      return false;
    }
  } else if (words.tens.hasOwnProperty(w)) {
    if (has.ones || has.teens || has.tens) {
      return false;
    }
  }
  return true;
};
module.exports = isValid;

},{"./data":67}],73:[function(_dereq_,module,exports){
'use strict';

module.exports = _dereq_('../../paths');

},{"../../paths":8}],74:[function(_dereq_,module,exports){
'use strict';

var paths = _dereq_('../../paths');
var Terms = paths.Terms;
var parse = _dereq_('./parse');
var fmt = _dereq_('./format');

// const unpackRange = function(ts) {
//   if (ts.has('#NumberRange')) {
//     ts.terms.forEach(t => {
//       if (t.silent_term && !t._text) {
//         t.text = t.silent_term;
//       }
//     });
//   }
//   return ts;
// };

var parseValue = function parseValue(ts) {
  ts.val = ts.match('#Value+');
  // ts.val = unpackRange(ts.val);
  ts.val = ts.val.list[0];
  ts.unit = ts.match('#Unit+');
  if (ts.unit.found) {
    ts.unit = ts.unit.list[0];
  }
  return ts;
};

var isPercent = function isPercent(val, unit) {
  //pre-tagged
  if (val.has('#Percent') || unit.has('#Percent')) {
    return true;
  }
  // 'five percent'
  if (unit.out('normal') === 'percent') {
    return true;
  }
  //'5%'
  if (val.out('normal').match(/%$/) !== null) {
    return true;
  }
  return false;
};

//set the text as the same num format
var setNumber = function setNumber(ts, num) {
  var str = ts.val.out();
  if (ts.has('#Ordinal')) {
    if (ts.has('#TextValue')) {
      str = fmt.textOrdinal(num); //ordinal text
    } else {
      str = fmt.ordinal(num); //ordinal number
    }
  } else if (ts.has('#TextValue')) {
    str = fmt.text(num); //cardinal text
  } else if (ts.has('#NiceNumber')) {
    str = fmt.nice(num); //8,929 number
  } else {
    str = fmt.cardinal(num); //cardinal number
  }
  //add the unit at the end
  if (ts.unit.found) {
    str += ts.unit.out('text');
  }
  ts = ts.replaceWith(str, true);
  return parseValue(ts);
};

var Value = function Value(arr, world, refText, refTerms) {
  Terms.call(this, arr, world, refText, refTerms);
  parseValue(this);
};

//Terms inheritence
Value.prototype = Object.create(Terms.prototype);

var methods = {
  data: function data() {
    var num = parse(this.val);
    return {
      number: num,
      nice: fmt.nice(num),
      ordinal: fmt.ordinal(num),
      niceOrdinal: fmt.niceOrdinal(num),
      text: fmt.text(num),
      textOrdinal: fmt.textOrdinal(num),
      unit: this.unit.out('normal')
    };
  },
  number: function number() {
    return parse(this.val);
  },
  // /** five -> '5' */
  toNumber: function toNumber() {
    var num = parse(this.val);
    if (num || num === 0) {
      var str = '';
      if (this.val.has('#Ordinal')) {
        str = fmt.ordinal(num);
      } else {
        str = String(num);
        //convert 'five percent' -> '5%'
        if (isPercent(this.val, this.unit)) {
          str = str + '%';
          this.unit.delete();
        }
      }
      // let before = this.terms[0].whitespace.before;
      // let after = this.terms[this.terms.length - 1].whitespace.after;
      if (this.unit.found) {
        str = str + this.unit.out('text');
      }
      this.replaceWith(str, true).tag('NumericValue');
      //make sure unit gets the right tag..
      if (this.unit.found) {
        this.match(this.unit.out('normal')).tag('Unit');
      }
      // this.whitespace.before(before);
      // this.whitespace.after(after);
    }
    return this;
  },
  // /**5 -> 'five' */
  toText: function toText() {
    var num = parse(this.val);
    if (num || num === 0) {
      var str = '';
      if (this.val.has('#Ordinal')) {
        str = fmt.textOrdinal(num);
      } else {
        str = fmt.text(num);
        //add percent
        if (isPercent(this.val, this.unit)) {
          str = str + ' percent';
        }
      }
      if (this.unit.found) {
        str = str + this.unit.out('text');
      }
      this.replaceWith(str, true).tag('TextValue');
      //make sure unit gets the right tag..
      if (this.unit.found) {
        this.match(this.unit.out('normal')).tag('Unit');
      }
    }
    return this;
  },
  //
  // /**5th -> 5 */
  toCardinal: function toCardinal() {
    var num = parse(this.val);
    if (num || num === 0) {
      var str = '';
      if (this.val.has('#TextValue')) {
        str = fmt.text(num);
      } else {
        str = num;
      }
      if (this.unit.found) {
        str = str + this.unit.out('text');
      }
      this.replaceWith(str, true).tag('Cardinal');
      //make sure unit gets the right tag..
      if (this.unit.found) {
        this.match(this.unit.out('normal')).tag('Unit');
      }
    }
    return this;
  },
  //
  // /**5 -> 5th */
  toOrdinal: function toOrdinal() {
    var num = parse(this.val);
    if (num || num === 0) {
      var str = '';
      if (this.val.has('#TextValue')) {
        str = fmt.textOrdinal(num);
      } else {
        str = fmt.ordinal(num);
      }
      if (this.unit.found) {
        str = str + this.unit.out('text');
      }
      this.replaceWith(str, true).tag('Ordinal');
      //make sure unit gets the right tag..
      if (this.unit.found) {
        this.match(this.unit.out('normal')).tag('Unit');
      }
    }
    return this;
  },
  //
  // /**5900 -> 5,900 */
  toNice: function toNice() {
    var num = parse(this.val);
    if (num || num === 0) {
      var str = '';
      if (this.val.has('#Ordinal')) {
        str = fmt.niceOrdinal(num);
      } else {
        str = fmt.nice(num);
      }
      if (this.unit.found) {
        str = str + this.unit.out('text');
      }
      this.replaceWith(str, true).tag('NumericValue');
      //make sure unit gets the right tag..
      if (this.unit.found) {
        this.match(this.unit.out('normal')).tag('Unit');
      }
    }
    return this;
  },
  /** seven + 2 = nine */
  add: function add(n) {
    if (!n) {
      return this;
    }
    var num = parse(this.val) || 0;
    num += n; //add it
    return setNumber(this, num);
  },
  /** seven - 2 = five */
  subtract: function subtract(n) {
    if (!n) {
      return this;
    }
    var num = parse(this.val) || 0;
    num -= n; //subtract it
    return setNumber(this, num);
  },
  /**seven -> 'eight' */
  increment: function increment() {
    return this.add(1);
  },
  /**seven -> 'six' */
  decrement: function decrement() {
    return this.subtract(1);
  }
};

Object.keys(methods).forEach(function (k) {
  Value.prototype[k] = methods[k];
});
module.exports = Value;

},{"../../paths":8,"./format":59,"./parse":66}],75:[function(_dereq_,module,exports){
'use strict';

var Text = _dereq_('../../text');
var Verb = _dereq_('./verb');

//the () subset class
var methods = {
  conjugation: function conjugation(verbose) {
    return this.list.map(function (ts) {
      return ts.conjugation(verbose);
    });
  },
  conjugate: function conjugate(num, verbose) {
    //suppport only conjugating one verb in our result..
    if (num !== null && typeof num === 'number' && this.list[num]) {
      return this.list[num].conjugate(verbose);
    }
    //otherwise, return an array of conjugations
    return this.list.map(function (ts) {
      return ts.conjugate(verbose);
    });
  },

  /** plural/singular **/
  isPlural: function isPlural() {
    this.list = this.list.filter(function (ts) {
      return ts.isPlural();
    });
    return this;
  },
  isSingular: function isSingular() {
    this.list = this.list.filter(function (ts) {
      return !ts.isPlural();
    });
    return this;
  },

  /** negation **/
  isNegative: function isNegative() {
    this.list = this.list.filter(function (ts) {
      return ts.isNegative();
    });
    return this;
  },
  isPositive: function isPositive() {
    this.list = this.list.filter(function (ts) {
      return !ts.isNegative();
    });
    return this;
  },
  toNegative: function toNegative() {
    this.list = this.list.map(function (ts) {
      return ts.toNegative();
    });
    return this;
  },
  toPositive: function toPositive() {
    this.list.forEach(function (ts) {
      ts.toPositive();
    });
    return this;
  },

  /** tense **/
  toPastTense: function toPastTense() {
    this.list.forEach(function (ts) {
      ts.toPastTense();
    });
    return this;
  },
  toPresentTense: function toPresentTense() {
    this.list.forEach(function (ts) {
      ts.toPresentTense();
    });
    return this;
  },
  toFutureTense: function toFutureTense() {
    this.list.forEach(function (ts) {
      ts.toFutureTense();
    });
    return this;
  },
  toInfinitive: function toInfinitive() {
    this.list.forEach(function (ts) {
      ts.toInfinitive();
    });
    return this;
  },
  toGerund: function toGerund() {
    this.list.forEach(function (ts) {
      ts.toGerund();
    });
    return this;
  },
  asAdjective: function asAdjective() {
    return this.list.map(function (ts) {
      return ts.asAdjective();
    });
  }
};
//aliases
methods.toContinuous = methods.toGerund;

var find = function find(r, n) {
  r = r.match('(#Adverb|#Auxiliary|#Verb|#Negative|#Particle)+');
  r = r.splitAfter('#Comma');
  r = r.if('#Verb'); //this should be (much) smarter
  if (typeof n === 'number') {
    r = r.get(n);
  }
  r.list = r.list.map(function (ts) {
    return new Verb(ts.terms, ts.world, ts.refText, ts.refTerms);
  });
  return new Text(r.list, this.world, this.parent);
};

module.exports = Text.makeSubset(methods, find);

},{"../../text":192,"./verb":94}],76:[function(_dereq_,module,exports){
'use strict';

var predict = _dereq_('./methods/predict');
var isPlural = _dereq_('./methods/isPlural');

//'walking' - aka progressive
var isContinuous = function isContinuous(ts) {
  return ts.match('#Gerund').found;
};

//will not walk
var isNegative = function isNegative(ts) {
  var negs = ts.match('#Negative').list;
  if (negs.length === 2) {
    return false;
  }
  if (negs.length === 1) {
    return true;
  }
  return false;
};

//been walked by..
var isPassive = function isPassive(ts) {
  if (ts.match('is being #PastTense').found) {
    return true;
  }
  if (ts.match('(had|has) been #PastTense').found) {
    return true;
  }
  if (ts.match('will have been #PastTense').found) {
    return true;
  }
  return false;
};

//had walked
var isPerfect = function isPerfect(ts) {
  if (ts.match('^(had|have) #PastTense')) {
    return true;
  }
  return false;
};

//should walk, could walk
var getModal = function getModal(ts) {
  var modal = ts.match('#Modal');
  if (!modal.found) {
    return null;
  }
  return modal.out('normal');
};

//past/present/future
var getTense = function getTense(ts) {
  //look at the preceding words
  if (ts.auxiliary.found) {
    //'will'
    if (ts.match('will have #PastTense').found) {
      return 'Past';
    }
    if (ts.auxiliary.match('will').found) {
      return 'Future';
    }
    //'was'
    if (ts.auxiliary.match('was').found) {
      return 'Past';
    }
  }
  //look at the main verb tense
  if (ts.verb) {
    var tenses = {
      PastTense: 'Past',
      FutureTense: 'Future',
      FuturePerfect: 'Future'
    };
    var tense = predict(ts.verb); //yikes
    return tenses[tense] || 'Present';
  }
  return 'Present';
};

// const isImperative = function(ts) {};
// const isConditional = function(ts) {};

// detect signals in Auxiliary verbs
// 'will' -> future, 'have'->perfect, modals, negatives, adverbs
var interpret = function interpret(ts) {
  var isNeg = isNegative(ts);
  // let aux = ts.Auxiliary.clone();
  // aux = aux.not('(#Negative|#Adverb)');
  var obj = {
    negative: isNeg,
    continuous: isContinuous(ts),
    passive: isPassive(ts),
    perfect: isPerfect(ts),
    plural: isPlural(ts),
    modal: getModal(ts),
    tense: getTense(ts)
  };
  return obj;
};
module.exports = interpret;

},{"./methods/isPlural":86,"./methods/predict":87}],77:[function(_dereq_,module,exports){
'use strict';

var checkIrregulars = _dereq_('./irregulars');
var suffixPass = _dereq_('./suffixes');
var toActor = _dereq_('./toActor');
var generic = _dereq_('./generic');
var predict = _dereq_('../predict');
var toInfinitive = _dereq_('../toInfinitive');
var toBe = _dereq_('./toBe');

//turn a verb into all it's forms
var conjugate = function conjugate(t, world) {
  //handle is/was/will-be specially
  if (t.normal === 'is' || t.normal === 'was' || t.normal === 'will') {
    return toBe();
  }

  //dont conjugate didn't
  if (t.tags.Contraction) {
    t.text = t.silent_term;
  }
  var all = {
    PastTense: null,
    PresentTense: null,
    Infinitive: null,
    Gerund: null,
    Actor: null
  };
  //first, get its current form
  var form = predict(t);
  if (form) {
    all[form] = t.normal;
  }
  if (form !== 'Infinitive') {
    all['Infinitive'] = toInfinitive(t, world) || '';
  }
  //check irregular forms
  var irregObj = checkIrregulars(all['Infinitive'], world) || {};
  Object.keys(irregObj).forEach(function (k) {
    if (irregObj[k] && !all[k]) {
      all[k] = irregObj[k];
    }
  });
  //ok, send this infinitive to all conjugators
  var inf = all['Infinitive'] || t.normal;

  //check suffix rules
  var suffObj = suffixPass(inf);
  Object.keys(suffObj).forEach(function (k) {
    if (suffObj[k] && !all[k]) {
      all[k] = suffObj[k];
    }
  });
  //ad-hoc each missing form
  //to Actor
  if (!all.Actor) {
    all.Actor = toActor(inf);
  }

  //use fallback, generic transformations
  Object.keys(all).forEach(function (k) {
    if (!all[k] && generic[k]) {
      all[k] = generic[k](all);
    }
  });

  return all;
};

module.exports = conjugate;

},{"../predict":87,"../toInfinitive":90,"./generic":80,"./irregulars":82,"./suffixes":83,"./toActor":84,"./toBe":85}],78:[function(_dereq_,module,exports){
'use strict';

module.exports = [{
  reg: /(eave)$/i,
  repl: {
    pr: '$1s',
    pa: '$1d',
    gr: 'eaving',
    ar: '$1r'
  }
}, {
  reg: /(ink)$/i,
  repl: {
    pr: '$1s',
    pa: 'unk',
    gr: '$1ing',
    ar: '$1er'
  }
}, {
  reg: /(end)$/i,
  repl: {
    pr: '$1s',
    pa: 'ent',
    gr: '$1ing',
    ar: '$1er'
  }
}, {
  reg: /(ide)$/i,
  repl: {
    pr: '$1s',
    pa: 'ode',
    gr: 'iding',
    ar: 'ider'
  }
}, {
  reg: /(ake)$/i,
  repl: {
    pr: '$1s',
    pa: 'ook',
    gr: 'aking',
    ar: '$1r'
  }
}, {
  reg: /(eed)$/i,
  repl: {
    pr: '$1s',
    pa: '$1ed',
    gr: '$1ing',
    ar: '$1er'
  }
}, {
  reg: /(e)(ep)$/i,
  repl: {
    pr: '$1$2s',
    pa: '$1pt',
    gr: '$1$2ing',
    ar: '$1$2er'
  }
}, {
  reg: /(a[tg]|i[zn]|ur|nc|gl|is)e$/i,
  repl: {
    pr: '$1es',
    pa: '$1ed',
    gr: '$1ing',
    prt: '$1en'
  }
}, {
  reg: /([i|f|rr])y$/i,
  repl: {
    pr: '$1ies',
    pa: '$1ied',
    gr: '$1ying'
  }
}, {
  reg: /([td]er)$/i,
  repl: {
    pr: '$1s',
    pa: '$1ed',
    gr: '$1ing'
  }
}, {
  reg: /([bd]l)e$/i,
  repl: {
    pr: '$1es',
    pa: '$1ed',
    gr: '$1ing'
  }
}, {
  reg: /(ish|tch|ess)$/i,
  repl: {
    pr: '$1es',
    pa: '$1ed',
    gr: '$1ing'
  }
}, {
  reg: /(ion|end|e[nc]t)$/i,
  repl: {
    pr: '$1s',
    pa: '$1ed',
    gr: '$1ing'
  }
}, {
  reg: /(om)e$/i,
  repl: {
    pr: '$1es',
    pa: 'ame',
    gr: '$1ing'
  }
}, {
  reg: /(.eat)$/i,
  repl: {
    pr: '$1s',
    pa: '$1ed',
    gr: '$1ing'
  }
}, {
  reg: /([aeiu])([pt])$/i,
  repl: {
    pr: '$1$2s',
    pa: '$1$2',
    gr: '$1$2$2ing'
  }
}, {
  reg: /(er)$/i,
  repl: {
    pr: '$1s',
    pa: '$1ed',
    gr: '$1ing'
  }
}, {
  reg: /(en)$/i,
  repl: {
    pr: '$1s',
    pa: '$1ed',
    gr: '$1ing'
  }
}, {
  reg: /(ed)$/i,
  repl: {
    pr: '$1s',
    pa: '$1ded',
    ar: '$1der',
    gr: '$1ding'
  }
}, {
  reg: /(..)(ow)$/i,
  repl: {
    pr: '$1$2s',
    pa: '$1ew',
    gr: '$1$2ing',
    prt: '$1$2n'
  }
}, {
  reg: /(..)([cs]h)$/i,
  repl: {
    pr: '$1$2es',
    pa: '$1$2ed',
    gr: '$1$2ing'
  }
}, {
  reg: /([^aeiou][ou])(g|d)$/i,
  repl: {
    pr: '$1$2s',
    pa: '$1$2$2ed',
    gr: '$1$2$2ing'
  }
}, {
  reg: /([^aeiou][aeiou])(b|t|p|m)$/i,
  repl: {
    pr: '$1$2s',
    pa: '$1$2$2ed',
    gr: '$1$2$2ing'
  }
}, {
  reg: /([aeiou]zz)$/i,
  repl: {
    pr: '$1es',
    pa: '$1ed',
    gr: '$1ing'
  }
}];

},{}],79:[function(_dereq_,module,exports){
'use strict';

var checkIrregulars = _dereq_('./irregulars');
var suffixPass = _dereq_('./suffixes');
var generic = _dereq_('./generic');
//this method is the same as regular conjugate, but optimised for use in the lexicon during warm-up.
//it's way faster because it knows input is already infinitive

var want = ['Gerund', 'PastTense', 'PresentTense'];

var fasterConjugate = function fasterConjugate(inf, world) {
  var all = {
    Infinitive: inf
  };
  //check irregulars list
  if (world && world.conjugations) {
    var irregObj = checkIrregulars(all['Infinitive'], world);
    if (irregObj !== null) {
      Object.keys(irregObj).forEach(function (k) {
        if (irregObj[k] && !all[k]) {
          all[k] = irregObj[k];
        }
      });
    }
  }
  //check suffix rules
  var suffObj = suffixPass(inf);
  Object.keys(suffObj).forEach(function (k) {
    if (suffObj[k] && !all[k]) {
      all[k] = suffObj[k];
    }
  });
  for (var i = 0; i < want.length; i++) {
    if (all[want[i]] === undefined) {
      all[want[i]] = generic[want[i]](all);
    }
  }
  return all;
};
module.exports = fasterConjugate;
// console.log(fasterConjugate('repeat'));

},{"./generic":80,"./irregulars":82,"./suffixes":83}],80:[function(_dereq_,module,exports){
'use strict';
//non-specifc, 'hail-mary' transforms from infinitive, into other forms

var hasY = /[bcdfghjklmnpqrstvwxz]y$/;
var generic = {

  Gerund: function Gerund(o) {
    var inf = o.Infinitive;
    if (inf.charAt(inf.length - 1) === 'e') {
      return inf.replace(/e$/, 'ing');
    }
    return inf + 'ing';
  },

  PresentTense: function PresentTense(o) {
    var inf = o.Infinitive;
    if (inf.charAt(inf.length - 1) === 's') {
      return inf + 'es';
    }
    if (hasY.test(inf) === true) {
      return inf.slice(0, -1) + 'ies';
    }
    return inf + 's';
  },

  PastTense: function PastTense(o) {
    var inf = o.Infinitive;
    if (inf.charAt(inf.length - 1) === 'e') {
      return inf + 'd';
    }
    if (inf.substr(-2) === 'ed') {
      return inf;
    }
    if (hasY.test(inf) === true) {
      return inf.slice(0, -1) + 'ied';
    }
    return inf + 'ed';
  }

  // FutureTense: (o) => {
  //   return 'will ' + o.Infinitive;
  // },
  //
  // PerfectTense: (o) => {
  //   return 'have ' + (o.Participle || o.PastTense);
  // },
  //
  // Pluperfect: (o) => {
  //   if (o.PastTense) {
  //     return 'had ' + o.PastTense;
  //   }
  //   return null;
  // },
  // FuturePerfect: (o) => {
  //   if (o.PastTense) {
  //     return 'will have ' + o.PastTense;
  //   }
  //   return null;
  // }

};

module.exports = generic;

},{}],81:[function(_dereq_,module,exports){
'use strict';

var conjugate = _dereq_('./conjugate');
var toBe = _dereq_('./toBe');

var addAdverbs = function addAdverbs(obj, vb) {
  if (vb.adverbs.found) {
    //does the adverb go at the start or end?
    var isFirst = vb.first().match('#Adverb').found;
    Object.keys(obj).forEach(function (k) {
      if (isFirst) {
        obj[k] = vb.adverbs.out() + ' ' + obj[k];
      } else {
        obj[k] = obj[k] + vb.adverbs.out();
      }
    });
  }
  return obj;
};

//conjugation using auxillaries+adverbs and stuff
var multiWordConjugate = function multiWordConjugate(vb, verbose) {
  var isNegative = vb.negative.found;
  var isPlural = vb.isPlural();
  //handle 'to be' verb seperately
  if (vb.verb.tags.Copula || vb.verb.normal === 'be' && vb.auxiliary.match('will').found) {
    var isI = false;
    //account for 'i is' -> 'i am' irregular
    if (vb.parent && vb.parent.has('i #Adverb? #Copula')) {
      isI = true;
    }
    var copulas = toBe(isPlural, isNegative, isI);
    return addAdverbs(copulas, vb);
  }
  var obj = conjugate(vb.verb, vb.world, verbose);
  //apply particles
  if (vb.particle.found) {
    Object.keys(obj).forEach(function (k) {
      obj[k] = obj[k] + vb.particle.out();
    });
  }
  //apply negative
  if (isNegative) {
    obj.PastTense = 'did not ' + obj.Infinitive;
    obj.PresentTense = 'does not ' + obj.Infinitive;
    obj.Gerund = 'not ' + obj.Gerund;
  }
  //future Tense is pretty straightforward
  if (!obj.FutureTense) {
    if (isNegative) {
      obj.FutureTense = 'will not ' + obj.Infinitive;
    } else {
      obj.FutureTense = 'will ' + obj.Infinitive;
    }
  }
  //apply adverbs
  obj = addAdverbs(obj, vb);
  return obj;
};
module.exports = multiWordConjugate;

},{"./conjugate":77,"./toBe":85}],82:[function(_dereq_,module,exports){
'use strict';
// let irregulars = require('../../../../lexicon/uncompressed/irregularVerbs').irregulars; //weeee!

var fns = _dereq_('../../../../fns'); //weeee!
var forms = ['Participle', 'Gerund', 'PastTense', 'PresentTense', 'FuturePerfect', 'PerfectTense', 'Actor'];

var checkIrregulars = function checkIrregulars(str, world) {
  var irregulars = world.conjugations;
  var infArr = Object.keys(irregulars);
  //check irregulars in world
  if (world && world.conjugations && world.conjugations.hasOwnProperty(str) === true) {
    return world.conjugations[str];
  }
  //fast infinitive lookup
  if (irregulars.hasOwnProperty(str) === true) {
    var obj = fns.copy(irregulars[str]);
    obj.Infinitive = str;
    return obj;
  }
  //longer check of known-verb forms
  for (var i = 0; i < infArr.length; i++) {
    for (var o = 0; o < forms.length; o++) {
      var irObj = irregulars[infArr[i]];
      if (irObj[forms[o]] === str) {
        var _obj = fns.copy(irObj);
        _obj.Infinitive = infArr[i];
        return _obj;
      }
    }
  }
  return {};
};

module.exports = checkIrregulars;
// console.log(checkIrregulars('bit'));

},{"../../../../fns":3}],83:[function(_dereq_,module,exports){
'use strict';

var rules = _dereq_('./data/rules');
var mapping = {
  pr: 'PresentTense',
  pa: 'PastTense',
  gr: 'Gerund',
  prt: 'Participle',
  ar: 'Actor'
};
var keys = Object.keys(mapping);

//check suffix rules
var suffixPass = function suffixPass(inf) {
  var found = {};
  for (var i = 0; i < rules.length; i++) {
    if (rules[i].reg.test(inf) === true) {
      var obj = rules[i].repl;
      for (var o = 0; o < keys.length; o++) {
        if (obj.hasOwnProperty(keys[o]) === true) {
          var key = mapping[keys[o]];
          // console.log(rules[i]);
          found[key] = inf.replace(rules[i].reg, obj[keys[o]]);
        }
      }
      return found;
    }
  }
  return found;
};

module.exports = suffixPass;

},{"./data/rules":78}],84:[function(_dereq_,module,exports){
'use strict';
//turn 'walk' into 'walker'

var irregulars = {
  'tie': 'tier',
  'dream': 'dreamer',
  'sail': 'sailer',
  'run': 'runner',
  'rub': 'rubber',
  'begin': 'beginner',
  'win': 'winner',
  'claim': 'claimant',
  'deal': 'dealer',
  'spin': 'spinner'
};
var dont = {
  'aid': 1,
  'fail': 1,
  'appear': 1,
  'happen': 1,
  'seem': 1,
  'try': 1,
  'say': 1,
  'marry': 1,
  'be': 1,
  'forbid': 1,
  'understand': 1,
  'bet': 1
};
var rules = [{
  'reg': /e$/i,
  'repl': 'er'
}, {
  'reg': /([aeiou])([mlgp])$/i,
  'repl': '$1$2$2er'
}, {
  'reg': /([rlf])y$/i,
  'repl': '$1ier'
}, {
  'reg': /^(.?.[aeiou])t$/i,
  'repl': '$1tter'
}];

var toActor = function toActor(inf) {
  //check blacklist
  if (dont[inf]) {
    return null;
  }
  //check irregulars
  if (irregulars.hasOwnProperty(inf)) {
    return irregulars[inf];
  }
  //try rules
  for (var i = 0; i < rules.length; i++) {
    if (rules[i].reg.test(inf) === true) {
      return inf.replace(rules[i].reg, rules[i].repl);
    }
  }
  //yup,
  return inf + 'er';
};

module.exports = toActor;

},{}],85:[function(_dereq_,module,exports){
'use strict';
//too many special cases for is/was/will be

var toBe = function toBe(isPlural, isNegative, isI) {
  var obj = {
    PastTense: 'was',
    PresentTense: 'is',
    FutureTense: 'will be',
    Infinitive: 'is',
    Gerund: 'being',
    Actor: '',
    PerfectTense: 'been',
    Pluperfect: 'been'
  };
  //"i is" -> "i am"
  if (isI === true) {
    obj.PresentTense = 'am';
    obj.Infinitive = 'am';
  }
  if (isPlural) {
    obj.PastTense = 'were';
    obj.PresentTense = 'are';
    obj.Infinitive = 'are';
  }
  if (isNegative) {
    obj.PastTense += ' not';
    obj.PresentTense += ' not';
    obj.FutureTense = 'will not be';
    obj.Infinitive += ' not';
    obj.PerfectTense = 'not ' + obj.PerfectTense;
    obj.Pluperfect = 'not ' + obj.Pluperfect;
    obj.Gerund = 'not ' + obj.Gerund;
  }
  return obj;
};
module.exports = toBe;

},{}],86:[function(_dereq_,module,exports){
'use strict';
//sometimes you can tell if a verb is plural/singular, just by the verb
// i am / we were
//othertimes you need its noun 'we walk' vs 'i walk'

var isPlural = function isPlural(vb) {
  if (vb.match('(are|were|does)').found) {
    return true;
  }
  if (vb.match('(is|am|do|was)').found) {
    return false;
  }
  //consider its prior noun
  var noun = vb.getNoun();
  if (noun && noun.found) {
    if (noun.match('#Plural').found) {
      return true;
    }
    if (noun.match('#Singular').found) {
      return false;
    }
  }
  return null;
};
module.exports = isPlural;

},{}],87:[function(_dereq_,module,exports){
'use strict';

var suffix_rules = _dereq_('./suffix_rules');

var goodTypes = {
  Infinitive: true,
  Gerund: true,
  PastTense: true,
  PresentTense: true,
  FutureTense: true,
  PerfectTense: true,
  Pluperfect: true,
  FuturePerfect: true,
  Participle: true
};

var predictForm = function predictForm(term) {
  //do we already know the form?
  var keys = Object.keys(goodTypes);
  for (var i = 0; i < keys.length; i++) {
    if (term.tags[keys[i]]) {
      return keys[i];
    }
  }
  //consult our handy suffix rules
  var arr = Object.keys(suffix_rules);
  for (var _i = 0; _i < arr.length; _i++) {
    var substr = term.normal.substr(-arr[_i].length);
    if (substr === arr[_i] && term.normal.length > arr[_i].length) {
      return suffix_rules[arr[_i]];
    }
  }
  return null;
};

module.exports = predictForm;

},{"./suffix_rules":88}],88:[function(_dereq_,module,exports){
'use strict';
//suffix signals for verb tense, generated from test data

var compact = {
  'Gerund': ['ing'],
  'Actor': ['erer'],
  'Infinitive': ['ate', 'ize', 'tion', 'rify', 'then', 'ress', 'ify', 'age', 'nce', 'ect', 'ise', 'ine', 'ish', 'ace', 'ash', 'ure', 'tch', 'end', 'ack', 'and', 'ute', 'ade', 'ock', 'ite', 'ase', 'ose', 'use', 'ive', 'int', 'nge', 'lay', 'est', 'ain', 'ant', 'ent', 'eed', 'er', 'le', 'own', 'unk', 'ung', 'en'],
  'PastTense': ['ed', 'lt', 'nt', 'pt', 'ew', 'ld'],
  'PresentTense': ['rks', 'cks', 'nks', 'ngs', 'mps', 'tes', 'zes', 'ers', 'les', 'acks', 'ends', 'ands', 'ocks', 'lays', 'eads', 'lls', 'els', 'ils', 'ows', 'nds', 'ays', 'ams', 'ars', 'ops', 'ffs', 'als', 'urs', 'lds', 'ews', 'ips', 'es', 'ts', 'ns', 's']
};
var suffix_rules = {};
var keys = Object.keys(compact);
var l = keys.length;

for (var i = 0; i < l; i++) {
  var l2 = compact[keys[i]].length;
  for (var o = 0; o < l2; o++) {
    suffix_rules[compact[keys[i]][o]] = keys[i];
  }
}
module.exports = suffix_rules;

},{}],89:[function(_dereq_,module,exports){
'use strict';
//turn a infinitiveVerb, like "walk" into an adjective like "walkable"

var rules = [[/y$/, 'i'], //relay - reliable
[/([aeiou][n])$/, '$1n']];

//convert - 'convertible'
//http://grammarist.com/usage/able-ible/
//http://blog.oxforddictionaries.com/2012/10/ibles-and-ables/
var ible_suffixes = {
  collect: true,
  exhaust: true,
  convert: true,
  digest: true,
  discern: true,
  dismiss: true,
  reverse: true,
  access: true,
  collapse: true,
  express: true
};

var irregulars = {
  eat: 'edible',
  hear: 'audible',
  see: 'visible',
  defend: 'defensible',
  write: 'legible',
  move: 'movable',
  divide: 'divisible',
  perceive: 'perceptible'
};

//takes an infitive verb, and returns an adjective form
var toAdjective = function toAdjective(str) {
  if (irregulars.hasOwnProperty(str)) {
    return irregulars[str];
  }
  for (var i = 0; i < rules.length; i++) {
    if (rules[i][0].test(str) === true) {
      str = str.replace(rules[i][0], rules[i][1]);
    }
  }
  //ible/able
  var adj = str + 'able';
  if (ible_suffixes[str]) {
    adj = str + 'ible';
  }
  return adj;
};

module.exports = toAdjective;

},{}],90:[function(_dereq_,module,exports){
'use strict';
//turn any verb into its infinitive form

var rules = _dereq_('./rules');
var predict = _dereq_('../predict');

var toInfinitive = function toInfinitive(t, world) {
  var irregulars = world.cache.toInfinitive || {}; //verb_mapping(world.conjugations); //TODO: do this at world cache
  if (t.tags.Infinitive) {
    return t.normal;
  }
  //check the irregular verb conjugations
  if (irregulars.hasOwnProperty(t.normal) === true) {
    return irregulars[t.normal];
  }
  //check the suffix rules
  var form = predict(t);
  if (rules[form]) {
    for (var i = 0; i < rules[form].length; i++) {
      var rule = rules[form][i];
      if (t.normal.match(rule.reg)) {
        return t.normal.replace(rule.reg, rule.to);
      }
    }
  }
  return t.normal;
};

module.exports = toInfinitive;

},{"../predict":87,"./rules":91}],91:[function(_dereq_,module,exports){
'use strict';
//rules for turning a verb into infinitive form

var rules = {
  Participle: [{
    reg: /own$/i,
    to: 'ow'
  }, {
    reg: /(.)un([g|k])$/i,
    to: '$1in$2'
  }],
  Actor: [{
    reg: /(er)er$/i,
    to: '$1'
  }],
  PresentTense: [{
    reg: /(..)(ies)$/i,
    to: '$1y'
  }, {
    reg: /(tch|sh)es$/i,
    to: '$1'
  }, {
    reg: /(ss|zz)es$/i,
    to: '$1'
  }, {
    reg: /([tzlshicgrvdnkmu])es$/i,
    to: '$1e'
  }, {
    reg: /(n[dtk]|c[kt]|[eo]n|i[nl]|er|a[ytrl])s$/i,
    to: '$1'
  }, {
    reg: /(ow)s$/i,
    to: '$1'
  }, {
    reg: /(op)s$/i,
    to: '$1'
  }, {
    reg: /([eirs])ts$/i,
    to: '$1t'
  }, {
    reg: /(ll)s$/i,
    to: '$1'
  }, {
    reg: /(el)s$/i,
    to: '$1'
  }, {
    reg: /(ip)es$/i,
    to: '$1e'
  }, {
    reg: /ss$/i,
    to: 'ss'
  }, {
    reg: /s$/i,
    to: ''
  }],
  Gerund: [{
    reg: /pping$/i,
    to: 'p'
  }, {
    reg: /lling$/i,
    to: 'll'
  }, {
    reg: /tting$/i,
    to: 't'
  }, {
    reg: /dding$/i,
    to: 'd'
  }, {
    reg: /ssing$/i,
    to: 'ss'
  }, {
    reg: /(..)gging$/i,
    to: '$1g'
  }, {
    reg: /([^aeiou])ying$/i,
    to: '$1y'
  }, {
    reg: /([^ae]i.)ing$/i,
    to: '$1e'
  }, {
    reg: /(ea.)ing$/i,
    to: '$1'
  }, {
    reg: /(u[rtcb]|[bdtpkg]l|n[cg]|a[gdkvtc]|[ua]s|[dr]g|yz|o[rlsp]|cre)ing$/i,
    to: '$1e'
  }, {
    reg: /(ch|sh)ing$/i,
    to: '$1'
  }, {
    reg: /(..)ing$/i,
    to: '$1'
  }],
  PastTense: [{
    reg: /(ued)$/i,
    to: 'ue'
  }, {
    reg: /a([^aeiouy])ed$/i,
    to: 'a$1e'
  }, {
    reg: /([aeiou]zz)ed$/i,
    to: '$1'
  }, {
    reg: /(e|i)lled$/i,
    to: '$1ll'
  }, {
    reg: /(.)(sh|ch)ed$/i,
    to: '$1$2'
  }, {
    reg: /(tl|gl)ed$/i,
    to: '$1e'
  }, {
    reg: /(um?pt?)ed$/i,
    to: '$1'
  }, {
    reg: /(ss)ed$/i,
    to: '$1'
  }, {
    reg: /pped$/i,
    to: 'p'
  }, {
    reg: /tted$/i,
    to: 't'
  }, {
    reg: /(..)gged$/i,
    to: '$1g'
  }, {
    reg: /(..)lked$/i,
    to: '$1lk'
  }, {
    reg: /([^aeiouy][aeiou])ked$/i,
    to: '$1ke'
  }, {
    reg: /(.[aeiou])led$/i,
    to: '$1l'
  }, {
    reg: /(..)(h|ion|n[dt]|ai.|[cs]t|pp|all|ss|tt|int|ail|ld|en|oo.|er|k|pp|w|ou.|rt|ght|rm)ed$/i,
    to: '$1$2'
  }, {
    reg: /(.ut)ed$/i,
    to: '$1e'
  }, {
    reg: /(.pt)ed$/i,
    to: '$1'
  }, {
    reg: /(us)ed$/i,
    to: '$1e'
  }, {
    reg: /(..[^aeiouy])ed$/i,
    to: '$1e'
  }, {
    reg: /(..)ied$/i,
    to: '$1y'
  }, {
    reg: /(.o)ed$/i,
    to: '$1o'
  }, {
    reg: /(..i)ed$/i,
    to: '$1'
  }, {
    reg: /(.a[^aeiou])ed$/i,
    to: '$1'
  }, {
    reg: /([rl])ew$/i,
    to: '$1ow'
  }, {
    reg: /([pl])t$/i,
    to: '$1t'
  }]
};
module.exports = rules;

},{}],92:[function(_dereq_,module,exports){
'use strict';

//these are contractions with a implicit verb.
var expand = function expand(vb) {
  vb.match('#Contraction+').list.forEach(function (ts) {
    if (ts.has('#Verb')) {
      ts.terms.forEach(function (t) {
        if (t.silent_term) {
          //this term also needs a space now too
          if (!t.text) {
            t.whitespace.before = ' ';
          }
          t._text = t.silent_term;
          //handle (some) capitalization
          if (t.tags.TitleCase) {
            t.toTitleCase();
          }
          t.normalize();
          t.silent_term = null;
          t.unTag('Contraction', 'expanded');
        }
      });
    }
  });
  return vb;
};
module.exports = expand;

},{}],93:[function(_dereq_,module,exports){
'use strict';
//turns a verb negative - may not have enough information to do it properly
// (eg 'did not eat' vs 'does not eat') - needs the noun

var toInfinitive = _dereq_('./methods/toInfinitive');

//this methods operate on parentTerms, so return subset
var getVerb = function getVerb(ts) {
  ts = ts.match('(#Adverb|#Auxiliary|#Verb|#Negative|#Particle)+');
  ts = ts.splitAfter('#Comma');
  return ts.list[0];
};

var toNegative = function toNegative(ts) {
  //would not walk
  var modal = ts.match('#Auxiliary').first(); //.notIf('(is|are|was|will|has|had)').first(); //.first();
  if (modal.found) {
    var index = modal.list[0].index();
    var vb = ts.parentTerms.insertAt(index + 1, 'not', 'Verb');
    vb.match('not').tag('Negative', 'tag-not');
    return getVerb(vb);
  }

  //words that pair easily with a 'not' - 'is not'
  var copula = ts.match('(#Copula|will|has|had|do)').first();
  if (copula.found) {
    var _index = copula.list[0].index();
    var _vb = ts.parentTerms.insertAt(_index + 1, 'not', 'Verb');
    _vb.match('not').tag('Negative', 'tag-not');
    return getVerb(_vb);
  }

  var isPlural = ts.isPlural();

  //walked -> did not walk
  var past = ts.match('#PastTense').last();
  if (past.found) {
    // past.debug();
    var first = past.list[0];
    var _index2 = first.index();
    first.terms[0].text = toInfinitive(first.terms[0], ts.world);
    var _vb2 = ts.parentTerms.insertAt(_index2, 'did not', 'Verb');
    //add 'do not'?
    _vb2.match('not').tag('Negative', 'tag-not');
    return getVerb(_vb2);
  }

  //walks -> does not walk
  var pres = ts.match('#PresentTense').first();
  if (pres.found) {
    var _first = pres.list[0];
    var _index3 = _first.index();
    _first.terms[0].text = toInfinitive(_first.terms[0], ts.world);
    //some things use 'do not', everything else is 'does not'
    var noun = ts.getNoun();
    var _vb3 = null;
    if (noun.match('(i|we|they|you)').found) {
      _vb3 = ts.parentTerms.insertAt(_index3, 'do not', 'Verb');
    } else {
      _vb3 = ts.parentTerms.insertAt(_index3, 'does not', 'Verb');
    }
    _vb3.match('not').tag('Negative', 'tag-not');
    return getVerb(_vb3);
  }

  //not walking
  var gerund = ts.match('#Gerund').last();
  if (gerund.found) {
    var _index4 = gerund.list[0].index();
    var _vb4 = ts.parentTerms.insertAt(_index4, 'not', 'Verb');
    _vb4.match('not').tag('Negative', 'tag-not');
    return getVerb(_vb4);
  }

  //walk -> do not walk
  var verb = ts.match('#Verb').last();
  if (verb.found) {
    var _first2 = verb.list[0];
    var _index5 = _first2.index();
    _first2.terms[0].text = toInfinitive(_first2.terms[0], ts.world);
    var _vb5 = ts;
    if (isPlural) {
      _vb5 = ts.parentTerms.insertAt(_index5 - 1, 'do not', 'Verb');
    } else {
      _vb5 = ts.parentTerms.insertAt(_index5 - 1, 'does not', 'Verb');
    }
    _vb5.match('not').tag('Negative', 'tag-not');
    return getVerb(_vb5);
  }

  return ts;
};
module.exports = toNegative;

},{"./methods/toInfinitive":90}],94:[function(_dereq_,module,exports){
'use strict';

var Terms = _dereq_('../../paths').Terms;
var _conjugate = _dereq_('./methods/conjugate');
var toAdjective = _dereq_('./methods/toAdjective');
var interpret = _dereq_('./interpret');
var _toNegative = _dereq_('./toNegative');
var _isPlural = _dereq_('./methods/isPlural');
var expand = _dereq_('./methods/verbContraction');

var _parse = function _parse(r) {
  var original = r;
  r.negative = r.match('#Negative');
  r.adverbs = r.match('#Adverb');
  var aux = r.clone().not('(#Adverb|#Negative)');
  r.verb = aux.match('#Verb').not('#Particle').last();
  r.particle = aux.match('#Particle').last();
  if (r.verb.found) {
    var str = r.verb.out('normal');
    r.auxiliary = original.not(str).not('(#Adverb|#Negative)');
    r.verb = r.verb.list[0].terms[0];
    // r.auxiliary = aux.match('#Auxiliary+');
  } else {
    r.verb = original.terms[0];
  }
  return r;
};

var methods = {
  parse: function parse() {
    return _parse(this);
  },
  data: function data(verbose) {
    return {
      text: this.out('text'),
      normal: this.out('normal'),
      parts: {
        negative: this.negative.out('normal'),
        auxiliary: this.auxiliary.out('normal'),
        verb: this.verb.out('normal'),
        particle: this.particle.out('normal'),
        adverbs: this.adverbs.out('normal')
      },
      interpret: interpret(this, verbose),
      conjugations: this.conjugate()
    };
  },
  getNoun: function getNoun() {
    if (!this.refTerms) {
      return null;
    }
    var str = '#Adjective? #Noun+ ' + this.out('normal');
    return this.refTerms.match(str).match('#Noun+');
  },
  //which conjugation is this right now?
  conjugation: function conjugation() {
    return interpret(this, false).tense;
  },
  //blast-out all forms
  conjugate: function conjugate(verbose) {
    return _conjugate(this, verbose);
  },

  isPlural: function isPlural() {
    return _isPlural(this);
  },
  /** negation **/
  isNegative: function isNegative() {
    return this.match('#Negative').list.length === 1;
  },
  isPerfect: function isPerfect() {
    return this.auxiliary.match('(have|had)').found;
  },
  toNegative: function toNegative() {
    if (this.isNegative()) {
      return this;
    }
    return _toNegative(this);
  },
  toPositive: function toPositive() {
    return this.match('#Negative').delete();
  },

  /** conjugation **/
  toPastTense: function toPastTense() {
    if (this.has('#Contraction')) {
      this.list = expand(this.parentTerms).list;
    }
    var obj = this.conjugate();
    var end = obj.PastTense;
    var r = this.replaceWith(end, false);
    r.verb.tag('#PastTense');
    return r;
  },
  toPresentTense: function toPresentTense() {
    if (this.has('#Contraction')) {
      expand(this.parentTerms);
    }
    var obj = this.conjugate();
    var r = this.replaceWith(obj.PresentTense, false);
    r.verb.tag('#PresentTense');
    return r;
  },
  toFutureTense: function toFutureTense() {
    if (this.has('#Contraction')) {
      expand(this.parentTerms);
    }
    var obj = this.conjugate();
    var r = this.replaceWith(obj.FutureTense, false);
    r.verb.tag('#FutureTense');
    return r;
  },
  toInfinitive: function toInfinitive() {
    if (this.has('#Contraction')) {
      expand(this.parentTerms);
    }
    var obj = this.conjugate();
    var r = this.replaceWith(obj.Infinitive, false);
    r.verb.tag('#Infinitive');
    return r;
  },
  toGerund: function toGerund() {
    if (this.has('#Contraction')) {
      expand(this.parentTerms);
    }
    var obj = this.conjugate();
    var aux = 'is';
    //support 'i am', 'we are', 'he is'
    var noun = this.getNoun().out('normal');
    if (noun) {
      var auxList = {
        i: 'am',
        we: 'are',
        they: 'are'
      };
      if (auxList.hasOwnProperty(noun)) {
        aux = auxList[noun];
      }
    }
    var end = aux + ' ' + obj.Gerund;
    //i would go -> i would have be going
    // if (this.auxiliary && this.auxiliary.has('#Modal') && !this.auxiliary.has('will')) {
    //   end = this.auxiliary.match('#Modal').out() + ' have ' + end;
    // }
    var r = this.replaceWith(end, false);
    r.verb.tag('#Gerund');
    return r;
  },
  asAdjective: function asAdjective() {
    return toAdjective(this.verb.out('normal'));
  }
};

var Verb = function Verb(arr, world, refText, parentTerms) {
  Terms.call(this, arr, world, refText, parentTerms);
  //basic verb-phrase parsing:
  return _parse(this);
};
//Terms inheritence
Verb.prototype = Object.create(Terms.prototype);
//apply methods
Object.keys(methods).forEach(function (k) {
  Verb.prototype[k] = methods[k];
});
module.exports = Verb;

},{"../../paths":8,"./interpret":76,"./methods/conjugate":81,"./methods/isPlural":86,"./methods/toAdjective":89,"./methods/verbContraction":92,"./toNegative":93}],95:[function(_dereq_,module,exports){
'use strict';
//the steps and processes of pos-tagging

var step = {
  punctuation_step: _dereq_('./steps/01-punctuation_step'),
  emoji_step: _dereq_('./steps/02-emoji_step'),
  lexicon_step: _dereq_('./steps/03-lexicon_step'),
  lexicon_multi: _dereq_('./steps/04-lexicon_multi'),
  web_step: _dereq_('./steps/05-web_step'),
  suffix_step: _dereq_('./steps/06-suffix_step'),
  neighbour_step: _dereq_('./steps/07-neighbour_step'),
  capital_step: _dereq_('./steps/08-capital_step'),
  noun_fallback: _dereq_('./steps/09-noun_fallback'),
  contraction: _dereq_('./steps/10-contraction_step'),
  date_step: _dereq_('./steps/11-date_step'),
  auxiliary_step: _dereq_('./steps/12-auxiliary_step'),
  negation_step: _dereq_('./steps/13-negation_step'),
  comma_step: _dereq_('./steps/14-comma_step'),
  quotation_step: _dereq_('./steps/15-quotation_step'),
  possessive_step: _dereq_('./steps/16-possessive_step'),
  acronym_step: _dereq_('./steps/17-acronym_step'),
  person_step: _dereq_('./steps/18-person_step'),
  organization_step: _dereq_('./steps/19-organization_step'),
  parentheses_step: _dereq_('./steps/20-parentheses_step'),
  plural_step: _dereq_('./steps/21-plural_step'),
  value_step: _dereq_('./steps/22-value_step'),
  corrections: _dereq_('./steps/23-corrections'),
  properNoun: _dereq_('./steps/24-proper_noun'),
  custom: _dereq_('./steps/25-custom')
};
var tagPhrase = _dereq_('./phrase');

var tagger = function tagger(ts) {
  ts = step.punctuation_step(ts);
  ts = step.emoji_step(ts);
  ts = step.lexicon_step(ts);
  ts = step.lexicon_multi(ts);
  ts = step.web_step(ts);
  ts = step.suffix_step(ts);
  ts = step.comma_step(ts); //formerly #14
  ts = step.neighbour_step(ts);
  ts = step.capital_step(ts);
  ts = step.noun_fallback(ts);
  ts = step.contraction(ts);
  ts = step.date_step(ts); //3ms
  ts = step.auxiliary_step(ts);
  ts = step.negation_step(ts);
  ts = step.quotation_step(ts);
  ts = step.possessive_step(ts);
  ts = step.acronym_step(ts);
  ts = step.person_step(ts); //1ms
  ts = step.organization_step(ts);
  ts = step.parentheses_step(ts);
  ts = step.plural_step(ts);
  ts = step.value_step(ts);
  ts = step.corrections(ts); //2ms
  ts = step.properNoun(ts);
  ts = tagPhrase(ts);
  ts = step.custom(ts);
  return ts;
};

module.exports = tagger;

},{"./phrase":98,"./steps/01-punctuation_step":99,"./steps/02-emoji_step":100,"./steps/03-lexicon_step":101,"./steps/04-lexicon_multi":102,"./steps/05-web_step":103,"./steps/06-suffix_step":104,"./steps/07-neighbour_step":105,"./steps/08-capital_step":106,"./steps/09-noun_fallback":107,"./steps/10-contraction_step":108,"./steps/11-date_step":109,"./steps/12-auxiliary_step":110,"./steps/13-negation_step":111,"./steps/14-comma_step":112,"./steps/15-quotation_step":113,"./steps/16-possessive_step":114,"./steps/17-acronym_step":115,"./steps/18-person_step":116,"./steps/19-organization_step":117,"./steps/20-parentheses_step":118,"./steps/21-plural_step":119,"./steps/22-value_step":120,"./steps/23-corrections":121,"./steps/24-proper_noun":122,"./steps/25-custom":123}],96:[function(_dereq_,module,exports){
'use strict';

//

var conditionPass = function conditionPass(ts) {
  //'if it really goes, I will..'
  var m = ts.match('#Condition .{1,7} #ClauseEnd');
  //make sure it ends on a comma
  if (m.found && m.match('#Comma$')) {
    m.tag('Condition');
  }
  //'go a bit further, if it then has a pronoun
  m = ts.match('#Condition .{1,13} #ClauseEnd #Pronoun');
  if (m.found && m.match('#Comma$')) {
    m.not('#Pronoun$').tag('Condition', 'end-pronoun');
  }
  //if it goes then ..
  m = ts.match('#Condition .{1,7} then');
  if (m.found) {
    m.not('then$').tag('Condition', 'cond-then');
  }
  //as long as ..
  m = ts.match('as long as .{1,7} (then|#ClauseEnd)');
  if (m.found) {
    m.not('then$').tag('Condition', 'as-long-then');
  }
  //at the end of a sentence:
  //'..., if it really goes.'
  m = ts.match('#Comma #Condition .{1,7} .$');
  if (m.found) {
    m.not('^#Comma').tag('Condition', 'comma-7-end');
  }
  // '... if so.'
  m = ts.match('#Condition .{1,4}$');
  if (m.found) {
    m.tag('Condition', 'cond-4-end');
  }
  return ts;
};

module.exports = conditionPass;

},{}],97:[function(_dereq_,module,exports){
'use strict';
//a verbPhrase is a sequence of axiliaries, adverbs and verbs

var verbPhrase = function verbPhrase(ts) {
  if (ts.has('(#Verb|#Auxiliary)')) {
    ts.match('#Verb').tag('VerbPhrase', 'verbphrase-verb');
    //quickly was
    ts.match('#Adverb #Verb').tag('VerbPhrase', 'adverb-verb');
    //was quickly
    ts.match('#Verb #Adverb').tag('VerbPhrase', 'verb-adverb');
    //is not
    ts.match('#Verb #Negative').tag('VerbPhrase', 'verb-not');
    //never is
    ts.match('never #Verb').tag('VerbPhrase', 'not-verb');
    //'will have had'..
    ts.match('#Auxiliary+').tag('VerbPhrase', '2');
    // 'is'
    ts.match('#Copula').tag('VerbPhrase', '#3');
    //'really will'..
    ts.match('#Adverb #Auxiliary').tag('VerbPhrase', '#4');
    //to go
    // ts.match('to #Infinitive').tag('VerbPhrase', '#5');
    //work with
    // ts.match('#Verb #Preposition').tag('VerbPhrase', '#6');
  }
  return ts;
};

module.exports = verbPhrase;

},{}],98:[function(_dereq_,module,exports){
'use strict';

var conditionPass = _dereq_('./00-conditionPass');
var verbPhrase = _dereq_('./01-verbPhrase');
// const nounPhrase = require('./02-nounPhrase');
// const AdjectivePhrase = require('./03-adjectivePhrase');
//
var phraseTag = function phraseTag(ts) {
  ts = conditionPass(ts);
  ts = verbPhrase(ts);
  // ts = nounPhrase(ts);
  // ts = AdjectivePhrase(ts);
  return ts;
};

module.exports = phraseTag;

},{"./00-conditionPass":96,"./01-verbPhrase":97}],99:[function(_dereq_,module,exports){
'use strict';
//regs-

var titleCase = /^[A-Z][a-z']/;
var romanNum = /^[IVXCM]+$/;

//not so smart (right now)
var isRomanNumeral = function isRomanNumeral(t) {
  if (t.text.length > 1 && romanNum.test(t.text) === true) {
    return t.canBe('RomanNumeral');
  }
  return false;
};

var oneLetters = {
  a: true,
  i: true,
  //internet-slang
  u: true,
  r: true,
  c: true,
  k: true
};

var punctuation_step = function punctuation_step(ts) {
  var rules = ts.world.regex || [];
  ts.terms.forEach(function (t, o) {
    var str = t.text;
    //anything can be titlecase
    if (titleCase.test(str) === true) {
      t.tag('TitleCase', 'punct-rule');
    }
    //add hyphenation
    if (t.whitespace.after === '-' && ts.terms[o + 1] && ts.terms[o + 1].whitespace.before === '') {
      t.tag('Hyphenated', 'has-hyphen');
      ts.terms[o + 1].tag('Hyphenated', 'has-hyphen');
    }
    //look at () parentheses
    if (t.text[0] === '(') {
      t.tag('StartBracket');
    }
    //look at end-brackets (allow some punctuation after)!
    if (/\)[,.?!;:]?$/.test(t.text) === true) {
      t.tag('EndBracket');
    }
    //ok, normalise it a little,
    str = str.replace(/[,\.\?]$/, '');
    //do punctuation rules (on t.text)
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (r.reg.test(str) === true) {
        //don't over-write any other known tags
        if (t.canBe(r.tag)) {
          t.tag(r.tag, 'punctuation-rule- "' + r.reg.toString() + '"');
        }
        return;
      }
    }
    //terms like 'e'
    if (str.length === 1 && ts.terms[o + 1] && /[A-Z]/.test(str) && !oneLetters[str.toLowerCase()]) {
      t.tag('Acronym', 'one-letter-acronym');
    }
    //roman numerals (weak rn)
    if (isRomanNumeral(t)) {
      t.tag('RomanNumeral', 'is-roman-numeral');
    }
    //'100+'
    if (/[0-9]\+$/.test(t.text) === true) {
      t.tag('NumericValue', 'number-plus');
    }
  });
  return ts;
};

module.exports = punctuation_step;

},{}],100:[function(_dereq_,module,exports){
'use strict';

var emojiReg = _dereq_('./rules/emoji_regex');
var emoticon = _dereq_('./rules/emoticon_list');
//for us, there's three types -
// * ;) - emoticons
// * 🌵 - unicode emoji
// * :smiling_face: - asci-represented emoji

//test for forms like ':woman_tone2:‍:ear_of_rice:'
//https://github.com/Kikobeats/emojis-keywords/blob/master/index.js
var isCommaEmoji = function isCommaEmoji(t) {
  if (t.text.charAt(0) === ':') {
    //end comma can be last or second-last ':haircut_tone3:‍♀️'
    if (t.text.match(/:.?$/) === null) {
      return false;
    }
    //ensure no spaces
    if (t.text.match(' ')) {
      return false;
    }
    //reasonably sized
    if (t.text.length > 35) {
      return false;
    }
    return true;
  }
  return false;
};

//check against emoticon whitelist
var isEmoticon = function isEmoticon(t) {
  //normalize the 'eyes'
  var str = t.text.replace(/^[:;]/, ':');
  return emoticon.hasOwnProperty(str) === true;
};

//
var emojiStep = function emojiStep(ts) {
  for (var i = 0; i < ts.terms.length; i++) {
    var t = ts.terms[i];
    //test for :keyword: emojis
    if (isCommaEmoji(t)) {
      t.tag('Emoji', 'comma-emoji');
    }
    //test for unicode emojis
    if (t.text.match(emojiReg)) {
      t.tag('Emoji', 'unicode-emoji');
    }
    //test for emoticon ':)' emojis
    if (isEmoticon(t)) {
      t.tag('Emoji', 'emoticon-emoji');
    }
  }
  return ts;
};
module.exports = emojiStep;

},{"./rules/emoji_regex":130,"./rules/emoticon_list":131}],101:[function(_dereq_,module,exports){
'use strict';

var split = _dereq_('./contraction/split');
// const l = require('../../lexicon/init');
// const lexicon = l.lexicon;

var lexicon_pass = function lexicon_pass(ts) {
  var lexicon = ts.world.words || {};
  //loop through each term
  for (var i = 0; i < ts.terms.length; i++) {
    var t = ts.terms[i];
    //basic term lookup
    if (lexicon.hasOwnProperty(t.normal) === true) {
      t.tag(lexicon[t.normal], 'lexicon');
      continue;
    }
    //support silent_term matches
    if (t.silent_term && lexicon.hasOwnProperty(t.silent_term) === true) {
      t.tag(lexicon[t.silent_term], 'silent_term-lexicon');
      continue;
    }
    //check root version too
    if (t.root && t.normal !== t.root) {
      if (lexicon.hasOwnProperty(t.root) === true) {
        t.tag(lexicon[t.root], 'lexicon');
        continue;
      }
    }
    //support contractions (manually)
    var parts = split(t);
    if (parts && parts.start) {
      var start = parts.start.toLowerCase();
      if (lexicon.hasOwnProperty(start) === true) {
        t.tag(lexicon[start], 'contraction-lexicon');
        continue;
      }
    }
  }
  return ts;
};

module.exports = lexicon_pass;

},{"./contraction/split":129}],102:[function(_dereq_,module,exports){
'use strict';

var MAX = 4;

//find terms in the lexicon longer than one word (like 'hong kong')
var findMultiWords = function findMultiWords(ts, i, world) {
  var lex = world.words;
  var start = ts.terms[i].root;
  var nextTerms = ts.terms.slice(i + 1, i + MAX).map(function (t) {
    return t.root;
  });
  //look for matches, try biggest first
  var max = MAX;
  if (nextTerms.length < max) {
    max = nextTerms.length;
  }
  for (var k = max; k > 0; k -= 1) {
    var howAbout = start + ' ' + nextTerms.slice(0, k).join(' ');
    if (lex.hasOwnProperty(howAbout) === true) {
      ts.slice(i, i + k + 1).tag(lex[howAbout], 'multi-lexicon-' + howAbout);
      return k;
    }
  }
  return 0;
};

//try multiple-word matches in the lexicon (users and default)
var lexiconMulti = function lexiconMulti(ts) {
  ts.world.cache = ts.world.cache || {};
  var firstWords = ts.world.cache.firstWords || {};
  for (var i = 0; i < ts.terms.length; i++) {
    var t = ts.terms[i];
    //try multi words from user-lexicon
    if (firstWords.hasOwnProperty(t.root) === true) {
      var jump = findMultiWords(ts, i, ts.world);
      i += jump;
      continue;
    }
  }
  return ts;
};
module.exports = lexiconMulti;

},{}],103:[function(_dereq_,module,exports){
'use strict';
//identify urls, hashtags, @mentions, emails
//regs

var email = /^\w+@\w+\.[a-z]{2,3}$/; //not fancy
var hashTag = /^#[a-z0-9_]{2,}$/;
var atMention = /^@\w{2,}$/;
var urlA = /^(https?:\/\/|www\.)\w+\.[a-z]{2,3}/; //with http/www
var urlB = /^[\w\.\/]+\.(com|net|gov|org|ly|edu|info|biz|ru|jp|de|in|uk|br)/; //http://mostpopularwebsites.net/top-level-domain

var web_pass = function web_pass(terms) {
  for (var i = 0; i < terms.length; i++) {
    var t = terms.get(i);
    var str = t.text.trim().toLowerCase();
    if (email.test(str) === true) {
      t.tag('Email', 'web_pass');
    }
    if (hashTag.test(str) === true) {
      t.tag('HashTag', 'web_pass');
    }
    if (atMention.test(str) === true) {
      t.tag('AtMention', 'web_pass');
    }
    if (urlA.test(str) === true || urlB.test(str) === true) {
      t.tag('Url', 'web_pass');
    }
  }
  return terms;
};

module.exports = web_pass;

},{}],104:[function(_dereq_,module,exports){
'use strict';

var regs = _dereq_('./rules/regex_list');
var suffixes = _dereq_('./rules/suffix_lookup');

var misc = [
//slang things
[/^(lol)+[sz]$/, 'Expression'], //lol
[/^ma?cd[aeiou]/, 'LastName'], //macdonell - Last patterns https://en.wikipedia.org/wiki/List_of_family_name_affixes
//starting-ones
[/^[\-\+]?[0-9][0-9,]*(\.[0-9])*$/, 'Cardinal'], //like 5
[/^(un|de|re)\\-[a-z]../, 'Verb'], [/^[\-\+]?[0-9]+(\.[0-9])*$/, 'NumericValue'], [/^https?\:?\/\/[a-z0-9]/, 'Url'], //the colon is removed in normalisation
[/^www\.[a-z0-9]/, 'Url'], [/^(over|under)[a-z]{2,}/, 'Adjective'], [/^[0-9]{1,4}\.[0-9]{1,2}\.[0-9]{1,4}$/, 'Date'], // 03-02-89
//ending-ones
[/^[0-9]+([a-z]{1,2})$/, 'Value'], //like 5kg
[/^[0-9][0-9,\.]*(st|nd|rd|r?th)$/, ['NumericValue', 'Ordinal']], //like 5th
//middle (anywhere)
[/[a-z]*\\-[a-z]*\\-/, 'Adjective']];

//straight-up lookup of known-suffixes
var lookup = function lookup(t) {
  var len = t.normal.length;
  var max = 7;
  if (len <= max) {
    max = len - 1;
  }
  for (var i = max; i > 1; i -= 1) {
    var str = t.normal.substr(len - i, len);
    if (suffixes[i][str] !== undefined) {
      // console.log('suffix-match: ' + str);
      return suffixes[i][str];
    }
  }
  return null;
};

//word-regexes indexed by last-character
var regexFn = function regexFn(t) {
  var char = t.normal.charAt(t.normal.length - 1);
  if (regs[char] === undefined) {
    return null;
  }
  var arr = regs[char];
  for (var o = 0; o < arr.length; o++) {
    if (arr[o][0].test(t.normal) === true) {
      return arr[o];
    }
  }
  return null;
};

var suffix_step = function suffix_step(ts) {
  for (var i = 0; i < ts.terms.length; i++) {
    var t = ts.terms[i];
    //try known suffixes
    var tag = lookup(t);
    if (tag !== null && t.canBe(tag) === true) {
      t.tag(tag, 'suffix-lookup');
      continue;
    }
    //apply regexes by final-char
    tag = regexFn(t);
    if (tag !== null && t.canBe(tag[1]) === true) {
      t.tag(tag[1], 'regex-list: ' + String(tag[0]));
      continue;
    }
    //apply misc regexes
    for (var o = 0; o < misc.length; o++) {
      if (misc[o][0].test(t.normal) === true) {
        tag = misc[o][1];
        if (t.canBe(tag) === true) {
          t.tag(tag, 'misc-regex-' + misc[o][0]);
        }
      }
    }
  }
  return ts;
};

module.exports = suffix_step;

},{"./rules/regex_list":133,"./rules/suffix_lookup":134}],105:[function(_dereq_,module,exports){
'use strict';

var markov = _dereq_('./rules/neighbours');
var afterThisWord = markov.afterThisWord;
var beforeThisWord = markov.beforeThisWord;
var beforeThisPos = markov.beforeThisPos;
var afterThisPos = markov.afterThisPos;

var nothing = {
  TitleCase: true,
  UpperCase: true,
  CamelCase: true,
  Hyphenated: true,
  StartBracket: true,
  EndBracket: true,
  Comma: true,
  ClauseEnd: true
};

//basically a last-ditch effort before everything falls back to a noun
//for unknown terms, look left + right first, and hit-up the markov-chain for clues
var neighbour_step = function neighbour_step(ts) {
  ts.terms.forEach(function (t, n) {
    //is it still unknown?
    var termTags = Object.keys(t.tags);
    termTags = termTags.filter(function (tag) {
      return nothing.hasOwnProperty(tag) === false;
    });
    if (termTags.length === 0) {
      var lastTerm = ts.terms[n - 1];
      var nextTerm = ts.terms[n + 1];
      //look at previous word for clues
      if (lastTerm && afterThisWord.hasOwnProperty(lastTerm.normal) && !lastTerm.tags.ClauseEnd) {
        t.tag(afterThisWord[lastTerm.normal], 'neighbour-after-"' + lastTerm.normal + '"');
        return;
      }
      //look at next word for clues..
      //(not if there's a comma, though)
      if (!t.tags.ClauseEnd && nextTerm && beforeThisWord.hasOwnProperty(nextTerm.normal)) {
        t.tag(beforeThisWord[nextTerm.normal], 'neighbour-before-"' + nextTerm.normal + '"');
        return;
      }
      //look at the last POS for clues
      var tags = [];
      if (lastTerm) {
        tags = Object.keys(lastTerm.tags);
        for (var i = 0; i < tags.length; i++) {
          if (afterThisPos[tags[i]]) {
            t.tag(afterThisPos[tags[i]], 'neighbour-after-[' + tags[i] + ']');
            return;
          }
        }
      }
      //look at the next POS for clues
      if (nextTerm) {
        tags = Object.keys(nextTerm.tags);
        for (var _i = 0; _i < tags.length; _i++) {
          if (beforeThisPos[tags[_i]]) {
            t.tag(beforeThisPos[tags[_i]], 'neighbour-before-[' + tags[_i] + ']');
            return;
          }
        }
      }
    }
  });

  return ts;
};

module.exports = neighbour_step;

},{"./rules/neighbours":132}],106:[function(_dereq_,module,exports){
'use strict';
//titlecase is a signal for a noun

var capital_logic = function capital_logic(s) {
  //(ignore first word)
  for (var i = 1; i < s.terms.length; i++) {
    var _t = s.terms[i];
    //has a capital, but isn't too weird.
    if (_t.tags.TitleCase && _t.isWord()) {
      _t.tag('Noun', 'capital-step');
      _t.tag('TitleCase', 'capital-step');
    }
  }
  //support first-word of sentence as proper titlecase
  var t = s.terms[0];
  if (t && t.tags.TitleCase) {
    if (t.tags.Person || t.tags.Organization || t.tags.Place) {
      t.tag('TitleCase', 'first-term-capital');
    }
  }
  return s;
};

module.exports = capital_logic;

},{}],107:[function(_dereq_,module,exports){
'use strict';
//tag word as noun if we know nothing about it, still.

//tags that dont really count

var nothing = {
  TitleCase: true,
  UpperCase: true,
  CamelCase: true,
  Hyphenated: true,
  StartBracket: true,
  EndBracket: true,
  Comma: true,
  ClauseEnd: true
};
//are the tags basically empty
var gotNothing = function gotNothing(t) {
  //fail-fast
  if (t.tags.Noun || t.tags.Verb || t.tags.Adjective) {
    return false;
  }
  var tags = Object.keys(t.tags);
  if (tags.length === 0) {
    return true;
  }
  if (tags.filter(function (tag) {
    return !nothing[tag];
  }).length === 0) {
    return true;
  }
  return false;
};

//in last-ditch, try to match 'rewatch' -> 'watch' in the lexicon
var tryRoot = function tryRoot(t) {
  if (/^(re|un)-?[^aeiou]./.test(t.normal) === true) {
    var str = t.normal.replace(/^(re|un)-?/, '');
    if (t.world.words.hasOwnProperty(str) === true) {
      var tag = t.world.words[str];
      if (tag === 'Infinitive' || tag === 'PresentTense' || tag === 'PastTense' || tag === 'Gerund') {
        return tag;
      }
    }
  }
  return null;
};

var noun_fallback = function noun_fallback(s) {
  for (var i = 0; i < s.terms.length; i++) {
    var t = s.terms[i];
    //fail-fast
    if (t.tags.Noun || t.tags.Verb) {
      continue;
    }
    //ensure it only has the tag 'Term'
    if (gotNothing(t)) {
      //ensure it's atleast word-looking
      if (t.isWord() === false) {
        continue;
      }
      var rootTag = tryRoot(t);
      if (rootTag !== null) {
        t.tag(rootTag, 'root-tag-match');
        continue;
      }
      t.tag('Noun', 'noun-fallback');
    }
  }
  return s;
};

module.exports = noun_fallback;

},{}],108:[function(_dereq_,module,exports){
'use strict';

var irregulars = _dereq_('./contraction/01-irregulars');
var isWasHas = _dereq_('./contraction/02-isWasHas');
var easyOnes = _dereq_('./contraction/03-easyOnes');
var numberRange = _dereq_('./contraction/04-numberRange');

//find and pull-apart contractions
var interpret = function interpret(ts) {
  //check irregulars
  ts = irregulars(ts);
  //guess-at ambiguous "'s" one
  ts = isWasHas(ts);
  //check easy ones
  ts = easyOnes(ts);
  //5-7
  ts = numberRange(ts);
  return ts;
};

module.exports = interpret;

},{"./contraction/01-irregulars":124,"./contraction/02-isWasHas":125,"./contraction/03-easyOnes":126,"./contraction/04-numberRange":127}],109:[function(_dereq_,module,exports){
'use strict';
//ambiguous 'may' and 'march'

var preps = '(in|by|before|during|on|until|after|of|within|all)';
var thisNext = '(last|next|this|previous|current|upcoming|coming)';
var sections = '(start|end|middle|starting|ending|midpoint|beginning)';
var seasons = '(spring|summer|winter|fall|autumn)';

//ensure a year is approximately typical for common years
//please change in one thousand years
var tagYear = function tagYear(v, reason) {
  if (v.found !== true) {
    return;
  }
  v.list.forEach(function (ts) {
    var num = parseInt(ts.terms[0].normal, 10);
    if (num && num > 1000 && num < 3000) {
      ts.terms[0].tag('Year', reason);
    }
  });
};
//same, but for less-confident values
var tagYearSafer = function tagYearSafer(v, reason) {
  if (v.found !== true) {
    return;
  }
  v.list.forEach(function (ts) {
    var num = parseInt(ts.terms[0].normal, 10);
    if (num && num > 1900 && num < 2030) {
      ts.terms[0].tag('Year', reason);
    }
  });
};

//non-destructively tag values & prepositions as dates
var datePass = function datePass(ts) {
  //ambiguous month - person forms
  var people = '(january|april|may|june|summer|autumn|jan|sep)';
  if (ts.has(people)) {
    //give to april
    ts.match('#Infinitive #Determiner? #Adjective? #Noun? (to|for) ' + people).lastTerm().tag('Person', 'ambig-person');
    //remind june
    ts.match('#Infinitive ' + people).lastTerm().tag('Person', 'infinitive-person');
    //may waits for
    ts.match(people + ' #PresentTense (to|for)').firstTerm().tag('Person', 'ambig-active');
    //april will
    ts.match(people + ' #Modal').firstTerm().tag('Person', 'ambig-modal');
    //would april
    ts.match('#Modal ' + people).lastTerm().tag('Person', 'modal-ambig');
    //with april
    ts.match('(that|with|for) ' + people).term(1).tag('Person', 'that-month');
    //it is may
    ts.match('#Copula ' + people).term(1).tag('Person', 'is-may');
    //may is
    ts.match(people + ' #Copula').term(0).tag('Person', 'may-is');
    //april the 5th
    ts.match(people + ' the? #Value').term(0).tag('Month', 'person-value');
    //wednesday april
    ts.match('#Date ' + people).term(1).tag('Month', 'correction-may');
    //may 5th
    ts.match(people + ' the? #Value').firstTerm().tag('Month', 'may-5th');
    //5th of may
    ts.match('#Value of ' + people).lastTerm().tag('Month', '5th-of-may');
    //by april
    ts.match(preps + ' ' + people).ifNo('#Holiday').term(1).tag('Month', 'preps-month');
    //this april
    ts.match('(next|this|last) ' + people).term(1).tag('Month', 'correction-may'); //maybe not 'this'
  }
  //ambiguous month - verb-forms
  var verbs = '(may|march)';
  if (ts.has(verbs)) {
    //quickly march
    ts.match('#Adverb ' + verbs).lastTerm().tag('Infinitive', 'ambig-verb');
    ts.match(verbs + ' #Adverb').lastTerm().tag('Infinitive', 'ambig-verb');
    //all march
    ts.match(preps + ' ' + verbs).lastTerm().tag('Month', 'in-month');
    //this march
    ts.match('(next|this|last) ' + verbs).lastTerm().tag('Month', 'this-month');
    //with date
    ts.match(verbs + ' the? #Value').firstTerm().tag('Month', 'march-5th');
    ts.match('#Value of? ' + verbs).lastTerm().tag('Month', '5th-of-march');
    //nearby
    ts.match('[' + verbs + '] .? #Date').lastTerm().tag('Month', 'march-and-feb');
    ts.match('#Date .? [' + verbs + ']').lastTerm().tag('Month', 'feb-and-march');

    if (ts.has('march')) {
      //march to
      ts.match('march (up|down|back|to|toward)').term(0).tag('Infinitive', 'march-to');
      //must march
      ts.match('#Modal march').term(1).tag('Infinitive', 'must-march');
    }
  }
  //sun 5th
  if (ts.has('sun')) {
    //sun feb 2
    ts.match('sun #Date').firstTerm().tag('WeekDay', 'sun-feb');
    //sun the 5th
    ts.match('sun the #Ordinal').tag('Date').firstTerm().tag('WeekDay', 'sun-the-5th');
    //the sun
    ts.match('#Determiner sun').lastTerm().tag('Singular', 'the-sun');
  }
  //sat, nov 5th
  if (ts.has('sat')) {
    //sat november
    ts.match('sat #Date').firstTerm().tag('WeekDay', 'sat-feb');
    //this sat
    ts.match(preps + ' sat').lastTerm().tag('WeekDay', 'sat');
  }

  //months:
  if (ts.has('#Month')) {
    //June 5-7th
    ts.match('#Month #DateRange+').tag('Date', 'correction-numberRange');
    //5th of March
    ts.match('#Value of #Month').tag('Date', 'value-of-month');
    //5 March
    ts.match('#Cardinal #Month').tag('Date', 'cardinal-month');
    //march 5 to 7
    ts.match('#Month #Value to #Value').tag('Date', 'value-to-value');
    //march the 12th
    ts.match('#Month the #Value').tag('Date', 'month-the-value');
  }

  ts.match('in the (night|evening|morning|afternoon|day|daytime)').tag('Time', 'in-the-night');
  ts.match('(#Value|#Time) (am|pm)').tag('Time', 'value-ampm');

  //months:
  if (ts.has('#Value')) {
    //for 4 months
    ts.match('for #Value #Duration').tag('Date', 'for-x-duration');
    //values
    ts.match('#Value #Abbreviation').tag('Value', 'value-abbr');
    ts.match('a #Value').if('(hundred|thousand|million|billion|trillion|quadrillion|quintillion|sextillion|septillion)').tag('Value', 'a-value');
    ts.match('(minus|negative) #Value').tag('Value', 'minus-value');
    ts.match('#Value grand').tag('Value', 'value-grand');
    // ts.match('#Ordinal (half|quarter)').tag('Value', 'ordinal-half');//not ready
    ts.match('(half|quarter) #Ordinal').tag('Value', 'half-ordinal');
    ts.match('(hundred|thousand|million|billion|trillion|quadrillion|quintillion|sextillion|septillion) and #Value').tag('Value', 'magnitude-and-value');
    ts.match('#Value (point|decimal) #Value').tag('Value', 'value-point-value');
    //for four days
    ts.match(preps + '? #Value #Duration').tag('Date', 'value-duration');
    ts.match('(#WeekDay|#Month) #Value').ifNo('#Money').tag('Date', 'date-value');
    ts.match('#Value (#WeekDay|#Month)').ifNo('#Money').tag('Date', 'value-date');
    //may twenty five
    var vs = ts.match('#TextValue #TextValue');
    if (vs.found && vs.has('#Date')) {
      vs.tag('#Date', 'textvalue-date');
    }
    //two days before
    ts.match('#Value #Duration #Conjunction').tag('Date', 'val-duration-conjunction');
    //two years old
    ts.match('#Value #Duration old').unTag('Date', 'val-years-old');
  }

  //seasons
  if (ts.has(seasons)) {
    ts.match(preps + '? ' + thisNext + ' ' + seasons).tag('Date', 'thisNext-season');
    ts.match('the? ' + sections + ' of ' + seasons).tag('Date', 'section-season');
  }

  //rest-dates
  if (ts.has('#Date')) {
    //june the 5th
    ts.match('#Date the? #Ordinal').tag('Date', 'correction-date');
    //last month
    ts.match(thisNext + ' #Date').tag('Date', 'thisNext-date');
    //by 5 March
    ts.match('due? (by|before|after|until) #Date').tag('Date', 'by-date');
    //tomorrow before 3
    ts.match('#Date (by|before|after|at|@|about) #Cardinal').not('^#Date').tag('Time', 'date-before-Cardinal');
    //saturday am
    ts.match('#Date (am|pm)').term(1).unTag('Verb').unTag('Copula').tag('Time', 'date-am');
    ts.match('(last|next|this|previous|current|upcoming|coming|the) #Date').tag('Date', 'next-feb');
    ts.match('#Date (#Preposition|to) #Date').tag('Date', 'date-prep-date');
    //start of june
    ts.match('the? ' + sections + ' of #Date').tag('Date', 'section-of-date');
    //fifth week in 1998
    ts.match('#Ordinal #Duration in #Date').tag('Date', 'duration-in-date');
    //early in june
    ts.match('(early|late) (at|in)? the? #Date').tag('Time', 'early-evening');
  }

  //year/cardinal tagging
  if (ts.has('#Cardinal')) {
    var v = ts.match('#Date #Value #Cardinal').lastTerm();
    tagYear(v, 'date-value-year');
    //scoops up a bunch
    v = ts.match('#Date+ #Cardinal').lastTerm();
    tagYear(v, 'date-year');
    //feb 8 2018
    v = ts.match('#Month #Value #Cardinal').lastTerm();
    tagYear(v, 'month-value-year');
    //feb 8 to 10th 2018
    v = ts.match('#Month #Value to #Value #Cardinal').lastTerm();
    tagYear(v, 'month-range-year');
    //in 1998
    v = ts.match('(in|of|by|during|before|starting|ending|for|year) #Cardinal').lastTerm();
    tagYear(v, 'in-year');
    //q2 2009
    v = ts.match('(q1|q2|q3|q4) [#Cardinal]');
    tagYear(v, 'in-year');
    //2nd quarter 2009
    v = ts.match('#Ordinal quarter [#Cardinal]');
    tagYear(v, 'in-year');
    //in the year 1998
    v = ts.match('the year [#Cardinal]');
    tagYear(v, 'in-year');

    //it was 1998
    v = ts.match('it (is|was) [#Cardinal]');
    tagYearSafer(v, 'in-year');
    //was 1998 and...
    v = ts.match('#Cardinal !#Plural').firstTerm();
    tagYearSafer(v, 'year-unsafe');
  }

  //another pass at dates..
  if (ts.has('#Date')) {
    //time:
    if (ts.has('#Time')) {
      ts.match('#Cardinal #Time').not('#Year').tag('Time', 'value-time');
      ts.match('(by|before|after|at|@|about) #Time').tag('Time', 'preposition-time');
      //2pm est
      ts.match('#Time (eastern|pacific|central|mountain)').term(1).tag('Time', 'timezone');
      ts.match('#Time (est|pst|gmt)').term(1).tag('Time', 'timezone abbr');
    }

    //fix over-greedy
    var date = ts.match('#Date+').splitOn('Clause');

    if (date.has('(#Year|#Time)') === false) {
      //12 february 12
      date.match('#Value (#Month|#Weekday) #Value').lastTerm().unTag('Date');
    }
  }

  return ts;
};

module.exports = datePass;

},{}],110:[function(_dereq_,module,exports){
'use strict';
//auxiliary verbs are extra verbs beside the main ones
// "[will be] going" - etc.

var Auxiliary = {
  'do': true,
  'don\'t': true,
  'does': true,
  'doesn\'t': true,
  'will': true,
  'wont': true,
  'won\'t': true,
  'have': true,
  'haven\'t': true,
  'had': true,
  'hadn\'t': true,
  'not': true
};

var corrections = function corrections(ts) {
  //set verbs as auxillaries
  for (var i = 0; i < ts.terms.length; i++) {
    var t = ts.terms[i];
    if (Auxiliary[t.normal] || Auxiliary[t.silent_term]) {
      var next = ts.terms[i + 1];
      //if next word is a verb
      if (next && (next.tags.Verb || next.tags.Adverb || next.tags.Negative)) {
        t.tag('Auxiliary', 'corrections-Auxiliary');
        continue;
      }
    }
  }
  return ts;
};

module.exports = corrections;

},{}],111:[function(_dereq_,module,exports){
'use strict';

// 'not' is sometimes a verb, sometimes an adjective

var negation_step = function negation_step(ts) {
  for (var i = 0; i < ts.length; i++) {
    var t = ts.get(i);
    if (t.normal === 'not' || t.silent_term === 'not') {
      //find the next verb/adjective
      for (var o = i + 1; o < ts.length; o++) {
        if (ts.get(o).tags.Verb) {
          t.tag('VerbPhrase', 'negate-verb');
          break;
        }
        if (ts.get(o).tags.Adjective) {
          t.tag('AdjectivePhrase', 'negate-adj');
          break;
        }
      }
    }
  }
  return ts;
};

module.exports = negation_step;

},{}],112:[function(_dereq_,module,exports){
'use strict';
//-types of comma-use-
// PlaceComma - Hollywood, California
// List       - cool, fun, and great.
// ClauseEnd  - if so, we do.

//like Toronto, Canada

var isPlaceComma = function isPlaceComma(ts, i) {
  var t = ts.terms[i];
  var nextTerm = ts.terms[i + 1];
  //'australia, canada' is a list
  if (nextTerm && t.tags.Place && !t.tags.Country && nextTerm.tags.Country) {
    return true;
  }
  return false;
};

//adj, noun, or verb
var mainTag = function mainTag(t) {
  if (t.tags.Adjective) {
    return 'Adjective';
  }
  if (t.tags.Noun) {
    return 'Noun';
  }
  if (t.tags.Verb) {
    return 'Verb';
  }
  if (t.tags.Value) {
    return 'Value';
  }
  return null;
};

//take the first term with a comma, and test to the right.
//the words with a comma must be the same pos.
var isList = function isList(ts, i) {
  var start = i;
  var tag = mainTag(ts.terms[i]);
  //ensure there's a following comma, and its the same pos
  //then a Conjunction
  var sinceComma = 0;
  var count = 0;
  var hasConjunction = false;
  for (i = i + 1; i < ts.terms.length; i++) {
    var t = ts.terms[i];
    //are we approaching the end
    if (count > 0 && t.tags.Conjunction) {
      hasConjunction = true;
      continue;
    }
    //found one,
    if (t.tags[tag]) {
      //looks good. keep it going
      if (t.tags.Comma) {
        count += 1;
        sinceComma = 0;
        continue;
      }
      if (count > 0 && hasConjunction) {
        //is this the end of the list?
        ts.slice(start, i).tag('List');
        return true;
      }
    }
    sinceComma += 1;
    //have we gone too far without a comma?
    if (sinceComma > 5) {
      return false;
    }
    //this one, not a clause..
    if (tag === 'Value') {
      return true;
    }
  }
  return false;
};

var commaStep = function commaStep(ts) {
  //tag the correct punctuation forms
  for (var i = 0; i < ts.terms.length; i++) {
    var t = ts.terms[i];
    var punct = t.getPunctuation();
    if (punct === ',') {
      t.tag('Comma', 'comma-step');
      continue;
    }
    if (punct === ';' || punct === ':') {
      t.tag('ClauseEnd', 'clause-punt');
      continue;
    }
    //support elipses
    if (t.whitespace.after.match(/^\.\./)) {
      t.tag('ClauseEnd', 'clause-elipses');
      continue;
    }

    //support ' - ' clause
    if (ts.terms[i + 1] && ts.terms[i + 1].whitespace.before.match(/ - /)) {
      t.tag('ClauseEnd', 'hypen-clause');
      continue;
    }
  }

  //disambiguate the commas now
  for (var _i = 0; _i < ts.terms.length; _i++) {
    var _t = ts.terms[_i];
    if (_t.tags.Comma) {
      //if we already got it
      if (_t.tags.List) {
        continue;
      }
      //like 'Hollywood, California'
      if (isPlaceComma(ts, _i)) {
        continue;
      }
      //like 'cold, wet hands'
      var found = isList(ts, _i);
      //otherwise, it's a phrasal comma, like 'you must, if you think so'
      if (!found) {
        _t.tag('ClauseEnd', 'phrasal-comma');
      }
    }
  }
  return ts;
};

module.exports = commaStep;

},{}],113:[function(_dereq_,module,exports){
'use strict';

var quotemarks = {
  '"': {
    close: '"',
    tag: 'StraightDoubleQuotes'
  },
  '\uFF02': {
    close: '\uFF02',
    tag: 'StraightDoubleQuotesWide'
  },
  '\'': {
    close: '\'',
    tag: 'StraightSingleQuotes'
  },

  '\u201C': {
    close: '\u201D',
    tag: 'CommaDoubleQuotes'
  },
  '\u2018': {
    close: '\u2019',
    tag: 'CommaSingleQuotes'
  },

  '\u201F': {
    close: '\u201D',
    tag: 'CurlyDoubleQuotesReversed'
  },
  '\u201B': {
    close: '\u2019',
    tag: 'CurlySingleQuotesReversed'
  },

  '\u201E': {
    close: '\u201D',
    tag: 'LowCurlyDoubleQuotes'
  },
  '\u2E42': {
    close: '\u201D',
    tag: 'LowCurlyDoubleQuotesReversed'
  },

  '\u201A': {
    close: '\u2019',
    tag: 'LowCurlySingleQuotes'
  },

  '\xAB': {
    close: '\xBB',
    tag: 'AngleDoubleQuotes'
  },
  '\u2039': {
    close: '\u203A',
    tag: 'AngleSingleQuotes'
  },

  // Prime 'non quotation'
  '\u2035': {
    close: '\u2032',
    tag: 'PrimeSingleQuotes'
  },
  '\u2036': {
    close: '\u2033',
    tag: 'PrimeDoubleQuotes'
  },
  '\u2037': {
    close: '\u2034',
    tag: 'PrimeTripleQuotes'
  },

  // Prime 'quotation' variation
  '\u301D': {
    close: '\u301E',
    tag: 'PrimeDoubleQuotes'
  },
  '`': {
    close: '\xB4',
    tag: 'PrimeSingleQuotes'
  },

  '\u301F': {
    close: '\u301E',
    tag: 'LowPrimeDoubleQuotesReversed'
  }
};

// Convert the close quote to a regex.
Object.keys(quotemarks).forEach(function (open) {
  quotemarks[open].regex = new RegExp(quotemarks[open].close + '[;:,.]*');
  quotemarks[open].open = open;
});

// Improve open match detection.
var startQuote = new RegExp('[' + Object.keys(quotemarks).join('') + ']');

//tag a inline quotation as such
var quotation_step = function quotation_step(ts) {
  // Isolate the text so it doesn't change.
  var terms = ts.terms.slice(0); //.map(e => e.text);
  for (var i = 0; i < terms.length; i++) {

    var t = ts.terms[i];
    if (startQuote.test(t.whitespace.before)) {
      // Get the match and split it into groups
      var quotes = t.whitespace.before.match(startQuote).shift().split('');
      // Get close and tag info.
      quotes = quotes.map(function (mark) {
        return quotemarks[mark];
      });
      // Look for the ending
      for (var o = 0; o < ts.terms.length; o++) {
        // max-length don't go-on forever
        if (!terms[i + o] || o > 28) {
          break;
        }
        // Find the close.
        var index = -1;
        for (var qi = 0; qi < quotes.length; qi += 1) {
          if (quotes[qi].regex.test(terms[i + o].whitespace.after) === true) {
            index = qi;
            break;
          }
        }
        if (index !== -1) {
          // Remove the found
          var quote = quotes.splice(index, 1).pop();

          if (quote.regex.test(ts.terms[i + o].normal)) {
            ts.terms[i + o].whitespace.after.replace(quote.regex, '');
          }
          // Tag the things.
          t.tag('StartQuotation', 'quotation_open');
          ts.terms[i + o].tag('EndQuotation', 'quotation_close');
          ts.slice(i, i + o + 1).tag('Quotation', 'quotation_step');
          // Compensate for multiple close quotes ('"Really"')
          o -= 1;
          if (!quotes.length) {
            break;
          }
        }
      }
    }
  }
  return ts;
};
module.exports = quotation_step;

},{}],114:[function(_dereq_,module,exports){
'use strict';
//decide if an apostrophe s is a contraction or not
// 'spencer's nice' -> 'spencer is nice'
// 'spencer's house' -> 'spencer's house'

var singleQuotes = [['\'', '\''], // Straight Single Quotes
['\u2018', '\u2019'], // Comma Single Quotes
['\u201B', '\u2019'], // Curly Single Quotes Reversed
['\u201A', '\u2019'], // Low Curly Single Quotes
['\u2035', '\u2032'], // Prime Single Quotes Alt
['`', '\xB4'] // Prime Single Quotes
];
//these are always contractions
var blacklist = ['it\'s', 'that\'s'];

// Get all types of single quote.
var apostrophes = '\'‘’‛‚‵′`´';
var afterWord = new RegExp('([a-z]s[' + apostrophes + '])\\W*$'); // [^\w]* match 0 or more of any char that is NOT alphanumeric
var hasApostrophe = new RegExp('[' + apostrophes + ']');
var trailers = new RegExp('[^' + apostrophes + '\\w]+$');

var quoteRegex = {};
singleQuotes.forEach(function (quote) {
  quoteRegex[quote[0]] = new RegExp(quote[1] + '[^' + quote[1] + '\\w]*$');
});

// Compensate for different `'`s in the blacklist
blacklist.map(function (item) {
  return new RegExp(item.replace('\'', '[' + apostrophes + ']'));
});

// A possessive means `'s` describes ownership
// Not a contraction, like it's -> `it is`
var is_possessive = function is_possessive(terms, text, index) {
  var thisWord = terms.get(index);
  var nextWord = terms.get(index + 1);
  var stepWord = terms.get(index + 2);

  //our booleans:
  // `blacklist` are always contractions, not possessive
  var inBlacklist = blacklist.map(function (r) {
    return text.match(r);
  }).find(function (m) {
    return m;
  });
  // If no apostrophe s or s apostrophe
  var endTick = hasApostrophe.test(thisWord.whitespace.after);
  // "spencers'" - this is always possessive - eg "flanders'"
  var hasPronoun = thisWord.tags.Pronoun;

  if (inBlacklist || hasPronoun || !endTick) {
    return false;
  }
  if (afterWord.test(text) || nextWord === undefined) {
    return true;
  }
  // Next word is 'house'
  if (nextWord.tags.Noun === true || thisWord.tags.ClauseEnd === true) {
    return true;
  }
  //rocket's red glare
  if (stepWord !== undefined && nextWord.tags.Adjective && stepWord.tags.Noun) {
    return true;
  }
  return false;
};

// Tag each term as possessive, if it should
var possessiveStep = function possessiveStep(ts) {
  var expectingClosers = [];
  for (var i = 0; i < ts.length; i++) {
    var term = ts.get(i);
    var text = term.text;

    // First detect open quotes before detecting apostrophes
    if (typeof quoteRegex[text[0]] !== 'undefined') {
      // Add the expected closing quotes to our inspection array.
      expectingClosers[expectingClosers.length] = quoteRegex[text[0]];
      text = text.slice(1);
    }

    // Pre checking for quotes. e.g: Carlos'.’. -> Carlos'.’
    text = text.replace(trailers, '');
    // If the string ends with an expected closer.
    var closer = -1;
    for (var qi = 0; qi < expectingClosers.length; qi += 1) {
      if (expectingClosers[qi].test(text) === true) {
        closer = qi;
        break;
      }
    }
    if (closer !== -1) {
      text = text.replace(expectingClosers[closer], '');
      delete expectingClosers[closer];
    }

    // Post checking for quotes. e.g: Carlos'. -> Carlos'
    text = text.replace(trailers, '');
    if (is_possessive(ts, text, i)) {
      // If it's not already a noun, co-erce it to one
      if (!term.tags['Noun']) {
        term.tag('Noun', 'possessive_pass');
      }
      term.tag('Possessive', 'possessive_pass');

      // If it's been detected as a `Contraction`
      if (term.tags.Contraction === true) {
        // Remove the `Contraction` tag and silent_terms
        term.unTag('Contraction');
        ts.terms.splice(i + 1, 1);
        term.silent_term = '';
      }
    }
  }
  return ts;
};
module.exports = possessiveStep;

},{}],115:[function(_dereq_,module,exports){
'use strict';

//tag 'FBI' as letters-representing-words.
//we guess if letters are an acronym in the Term class.

var acronym_step = function acronym_step(ts) {
  ts.terms.forEach(function (t) {
    if (t.isAcronym()) {
      t.tag('Acronym', 'acronym-step');
    }
  });
  return ts;
};

module.exports = acronym_step;

},{}],116:[function(_dereq_,module,exports){
'use strict';

//sort-out things like 'theresa may', or 'will jones'.

var person_step = function person_step(ts) {
  //mr Putin
  ts.match('(mr|mrs|ms|dr) (#TitleCase|#Possessive)+').tag('#Person', 'mr-putin');

  //a bunch of ambiguous first names
  var maybeNoun = '(rose|robin|dawn|ray|holly|bill|joy|viola|penny|sky|violet|daisy|melody|kelvin|hope|mercedes|olive|jewel|faith|van|charity|miles|lily|summer|dolly|rod|dick|cliff|lane|reed|kitty|art|jean|trinity)';
  if (ts.has(maybeNoun)) {
    ts.match('(#Determiner|#Adverb|#Pronoun|#Possessive) [' + maybeNoun + ']').tag('Noun', 'the-ray');
    ts.match(maybeNoun + ' (#Person|#Acronym|#TitleCase)').canBe('#Person').tag('Person', 'ray-smith');
  }
  //verbs or people-names
  var maybeVerb = '(pat|wade|ollie|will|rob|buck|bob|mark|jack)';
  if (ts.has(maybeVerb)) {
    ts.match('(#Modal|#Adverb) [' + maybeVerb + ']').tag('Verb', 'would-mark');
    ts.match(maybeVerb + ' (#Person|#TitleCase)').tag('Person', 'rob-smith');
  }
  //adjectives or people-names
  var maybeAdj = '(misty|rusty|dusty|rich|randy)';
  if (ts.has(maybeAdj)) {
    ts.match('#Adverb [' + maybeAdj + ']').tag('Adjective', 'really-rich');
    ts.match(maybeAdj + ' (#Person|#TitleCase)').tag('Person', 'randy-smith');
  }
  //dates as people names
  var maybeDate = '(april|june|may|jan|august|eve)';
  if (ts.has(maybeDate)) {
    ts.match(String(maybeDate) + ' (#Person|#TitleCase)').canBe('#Person').tag('Person', 'june-smith');
    ts.match('(in|during|on|by|before|#Date) [' + maybeDate + ']').canBe('#Date').tag('Date', 'in-june');
    ts.match(maybeDate + ' (#Date|#Value)').canBe('#Date').tag('Date', 'june-5th');
  }
  //place-names as people-names
  var maybePlace = '(paris|alexandria|houston|kobe|salvador|sydney)';
  if (ts.has(maybePlace)) {
    ts.match('(in|near|at|from|to|#Place) [' + maybePlace + ']').canBe('#Place').tag('Place', 'in-paris');
    ts.match('[' + maybePlace + '] #Place').canBe('#Place').tag('Place', 'paris-france');
    ts.match('[' + maybePlace + '] #Person').canBe('#Person').tag('Person', 'paris-hilton');
  }
  //this one is tricky
  if (ts.match('al')) {
    ts.match('al (#Person|#TitleCase)').canBe('#Person').tag('#Person', 'al-borlen');
    ts.match('#TitleCase al #TitleCase').canBe('#Person').tag('#Person', 'arabic-al-arabic');
  }
  //ambiguous honorifics
  ts.match('(private|general|major|corporal|lord|lady|secretary|premier) #Honorific? #Person').terms(0).tag('Honorific', 'ambg-honorifics');
  //first general..
  ts.match('(1st|2nd|first|second) #Honorific').terms(0).tag('Honorific', 'ordinal-honorific');

  // let firstNames = '()';
  // let names = ts.match(firstNames);
  // if (names.found) {
  //   //prolly not a name:
  //   if (ts.has('(#Determiner|#Adverb|#Pronoun|#Possessive) ' + firstNames)) {
  //     names.unTag('Person', 'the-bill');
  //   } else {
  //     //probably a name here:
  //     let name = ts.match('(#Honorific|#Person) ' + firstNames);
  //     if (!name.found) {
  //       name = ts.match(firstNames + ' (#Person|#Honorific|#TitleCase)');
  //     }
  //     if (name.found && name.has('(#Place|#Date|#Organization)') === false) {
  //       name.tag('Person', 'dr-bill');
  //       names.tag('FirstName', 'ambiguous-name');
  //     }
  //   }
  // }
  //tighter-matches for other ambiguous names:
  // ts.match('(al|) #Acronym? #LastName').firstTerm().tag('#FirstName', 'ambig-lastname');

  //methods requiring a firstname match
  if (ts.has('#FirstName')) {
    // Firstname x (dangerous)
    var tmp = ts.match('#FirstName #Noun').ifNo('^#Possessive').ifNo('#ClauseEnd .');
    tmp.lastTerm().canBe('#LastName').tag('#LastName', 'firstname-noun');
    //ferdinand de almar
    ts.match('#FirstName de #Noun').canBe('#Person').tag('#Person', 'firstname-de-noun');
    //Osama bin Laden
    ts.match('#FirstName (bin|al) #Noun').canBe('#Person').tag('#Person', 'firstname-al-noun');
    //John L. Foo
    ts.match('#FirstName #Acronym #TitleCase').tag('Person', 'firstname-acronym-titlecase');
    //Andrew Lloyd Webber
    ts.match('#FirstName #FirstName #TitleCase').tag('Person', 'firstname-firstname-titlecase');
    //Mr Foo
    ts.match('#Honorific #FirstName? #TitleCase').tag('Person', 'Honorific-TitleCase');
    //John Foo
    ts.match('#FirstName #TitleCase #TitleCase?').match('#Noun+').tag('Person', 'firstname-titlecase');
    //peter the great
    ts.match('#FirstName the #Adjective').tag('Person', 'correction-determiner5');
    //very common-but-ambiguous lastnames
    ts.match('#FirstName (green|white|brown|hall|young|king|hill|cook|gray|price)').tag('#Person', 'firstname-maybe');
    //Joe K. Sombrero
    ts.match('#FirstName #Acronym #Noun').ifNo('#Date').tag('#Person', 'n-acro-noun').lastTerm().tag('#LastName', 'n-acro-noun');
    // Dwayne 'the rock' Johnson
    ts.match('#FirstName [#Determiner? #Noun] #LastName').tag('#NickName', 'first-noun-last').tag('#Person', 'first-noun-last');

    //john bodego's
    ts.match('#FirstName (#Singular|#Possessive)').ifNo('#Date').ifNo('#NickName').tag('#Person', 'first-possessive').lastTerm().tag('#LastName', 'first-possessive');
  }

  //methods requiring a lastname match
  if (ts.has('#LastName')) {
    // x Lastname
    ts.match('#Noun #LastName').firstTerm().canBe('#FirstName').tag('#FirstName', 'noun-lastname');
    //ambiguous-but-common firstnames
    ts.match('(will|may|april|june|said|rob|wade|ray|rusty|drew|miles|jack|chuck|randy|jan|pat|cliff|bill) #LastName').firstTerm().tag('#FirstName', 'maybe-lastname');
    //Jani K. Smith
    ts.match('#TitleCase #Acronym? #LastName').ifNo('#Date').tag('#Person', 'title-acro-noun').lastTerm().tag('#LastName', 'title-acro-noun');
    //is foo Smith
    ts.match('#Copula (#Noun|#PresentTense) #LastName').term(1).tag('#FirstName', 'copula-noun-lastname');
  }

  //methods requiring a titlecase
  if (ts.has('#TitleCase')) {
    ts.match('#Acronym #TitleCase').canBe('#Person').tag('#Person', 'acronym-titlecase');
    //ludwig van beethovan
    ts.match('#TitleCase (van|al|bin) #TitleCase').canBe('#Person').tag('Person', 'correction-titlecase-van-titlecase');
    ts.match('#TitleCase (de|du) la? #TitleCase').canBe('#Person').tag('Person', 'correction-titlecase-van-titlecase');
    //Morgan Shlkjsfne
    ts.match('#Person #TitleCase').match('#TitleCase #Noun').canBe('#Person').tag('Person', 'correction-person-titlecase');
    //pope francis
    ts.match('(lady|queen|sister) #TitleCase').ifNo('#Date').ifNo('#Honorific').tag('#FemaleName', 'lady-titlecase');
    ts.match('(king|pope|father) #TitleCase').ifNo('#Date').tag('#MaleName', 'correction-poe');
  }

  //j.k Rowling
  ts.match('#Noun van der? #Noun').canBe('#Person').tag('#Person', 'von der noun');
  //king of spain
  ts.match('(king|queen|prince|saint|lady) of? #Noun').canBe('#Person').tag('#Person', 'king-of-noun');
  //mr X
  ts.match('#Honorific #Acronym').tag('Person', 'Honorific-TitleCase');
  //peter II
  ts.match('#Person #Person the? #RomanNumeral').tag('Person', 'correction-roman-numeral');

  //'Professor Fink', 'General McCarthy'
  ts.match('#Honorific #Person').tag('Person', 'Honorific-Person');

  //remove single 'mr'
  ts.match('^#Honorific$').unTag('Person', 'single-honorific');

  return ts;
};

module.exports = person_step;

},{}],117:[function(_dereq_,module,exports){
'use strict';
//orgwords like 'bank' in 'Foo Bank'

var orgWords = _dereq_('../../world/more-data/orgWords');

//could this word be an organization
var maybeOrg = function maybeOrg(t) {
  //must be a noun
  if (!t.tags.Noun) {
    return false;
  }
  //can't be these things
  if (t.tags.Pronoun || t.tags.Comma || t.tags.Possessive || t.tags.Place) {
    return false;
  }
  //must be one of these
  if (t.tags.TitleCase || t.tags.Organization || t.tags.Acronym) {
    return true;
  }
  return false;
};

var organization_step = function organization_step(ts) {
  for (var i = 0; i < ts.terms.length; i++) {
    var t = ts.terms[i];
    if (orgWords.hasOwnProperty(t.root) === true) {
      //eg. Toronto University
      var lastTerm = ts.terms[i - 1];
      if (lastTerm && maybeOrg(lastTerm)) {
        lastTerm.tag('Organization', 'org-word-1');
        t.tag('Organization', 'org-word-2');
        continue;
      }
      //eg. University of Toronto
      var nextTerm = ts.terms[i + 1];
      if (nextTerm && nextTerm.normal === 'of') {
        if (ts.terms[i + 2] && maybeOrg(ts.terms[i + 2])) {
          t.tag('Organization', 'org-of-word-1');
          nextTerm.tag('Organization', 'org-of-word-2');
          ts.terms[i + 2].tag('Organization', 'org-of-word-3');
          continue;
        }
      }
    }
  }
  if (ts.has('#Acronym')) {
    ts.match('the #Acronym').not('(iou|fomo|yolo|diy|dui|nimby)').lastTerm().tag('Organization', 'the-acronym');
    ts.match('#Acronym').match('#Possessive').tag('Organization', 'possessive-acronym');
  }
  return ts;
};
module.exports = organization_step;

},{"../../world/more-data/orgWords":221}],118:[function(_dereq_,module,exports){
'use strict';
//tag the words between '(' and ')' as #Parentheses

var parenthesesStep = function parenthesesStep(ts) {
  ts.terms.forEach(function (t, i) {
    if (t.tags.StartBracket) {
      for (var o = i; o < ts.terms.length; o += 1) {
        if (ts.terms[o].tags.EndBracket === true) {
          ts.slice(i, o + 1).tag('Parentheses');
          break;
        }
      }
    }
  });
  return ts;
};
module.exports = parenthesesStep;

},{}],119:[function(_dereq_,module,exports){
'use strict';

var isPlural = _dereq_('../../subset/nouns/isPlural');

var pluralStep = function pluralStep(ts) {
  for (var i = 0; i < ts.terms.length; i++) {
    var t = ts.terms[i];
    if (t.tags.Noun) {
      //skip existing fast
      if (t.tags.Singular || t.tags.Plural) {
        continue;
      }
      //check if it's plural
      var plural = isPlural(t, t.world); //can be null if unknown
      if (plural === true) {
        t.tag('Plural', 'pluralStep');
      } else if (plural === false) {
        t.tag('Singular', 'pluralStep');
      }
    }
  }
  return ts;
};

module.exports = pluralStep;

},{"../../subset/nouns/isPlural":39}],120:[function(_dereq_,module,exports){
'use strict';
//regs-

var numericCardinal = /^\$?[0-9,](\.[0-9])?/;
var isOrdinal = /[0-9](st|nd|rd|th)$/;
// const hasText = /^[a-z]/;

var value_step = function value_step(ts) {
  for (var i = 0; i < ts.terms.length; i++) {
    var t = ts.terms[i];
    if (t.tags.Value === true) {
      //ordinal/cardinal
      if (t.tags.Ordinal === undefined && t.tags.Cardinal === undefined) {
        if (numericCardinal.test(t.normal) === true) {
          t.tag('Cardinal', 'cardinal-val-regex');
          t.tag('NumericValue', 'NumericValue-regex');
        } else if (isOrdinal.test(t.normal) === true) {
          t.tag('Ordinal', 'ordinal-value-regex');
          t.tag('NumericValue', 'NumericValue-regex');
        }
      }
      //text/number
      // if (t.tags.TextValue === undefined && t.tags.NumericValue === undefined) {
      //   if (hasText.test(t.normal) === true) {
      //     t.tag('TextValue', 'TextValue-regex');
      //   } else {
      //     t.tag('NumericValue', 'NumericValue-regex');
      //   }
      // }
    }
  }
  //5 books
  ts.match('#Cardinal #Plural').lastTerm().tag('Unit', 'cardinal-plural');
  //5th book
  ts.match('#Ordinal #Singular').lastTerm().tag('Unit', 'ordinal-singular');
  return ts;
};

module.exports = value_step;

},{}],121:[function(_dereq_,module,exports){
'use strict';

//mostly pos-corections here

var corrections = function corrections(ts) {
  //ambig prepositions/conjunctions
  if (ts.has('so')) {
    //so funny
    ts.match('so #Adjective').match('so').tag('Adverb', 'so-adv');
    //so the
    ts.match('so #Noun').match('so').tag('Conjunction', 'so-conj');
    //do so
    ts.match('do so').match('so').tag('Noun', 'so-noun');
  }
  if (ts.has('all')) {
    //all students
    ts.match('[all] #Determiner? #Noun').tag('Adjective', 'all-noun');
    //it all fell apart
    ts.match('[all] #Verb').tag('Adverb', 'all-verb');
  }
  //the ambiguous word 'that' and 'which'
  if (ts.has('(that|which)')) {
    //remind john that
    ts.match('#Verb #Adverb? #Noun (that|which)').lastTerm().tag('Preposition', 'that-prep');
    //that car goes
    ts.match('that #Noun #Verb').firstTerm().tag('Determiner', 'that-determiner');
    //things that provide
    // ts.match('#Plural (that|which) #Adverb? #Verb').term(1).tag('Preposition', 'noun-that');
  }
  //Determiner-signals
  if (ts.has('#Determiner')) {
    //the wait to vote
    ts.match('(the|this) [#Verb] #Preposition .').tag('Noun', 'correction-determiner1');
    //the swim
    ts.match('(the|those|these) (#Infinitive|#PresentTense|#PastTense)').term(1).tag('Noun', 'correction-determiner2');
    //a staggering cost
    ts.match('(a|an) [#Gerund]').tag('Adjective', 'correction-a|an');
    ts.match('(a|an) #Adjective (#Infinitive|#PresentTense)').term(2).tag('Noun', 'correction-a|an2');
    //some pressing issues
    ts.match('(some [#Verb] #Plural').tag('Noun', 'correction-determiner6');
    //the orange.
    ts.match('#Determiner #Adjective$').not('(#Comparative|#Superlative)').term(1).tag('Noun', 'the-adj-1');
    //the orange is
    ts.match('#Determiner [#Adjective] (#Copula|#PastTense|#Auxiliary)').tag('Noun', 'the-adj-2');
    //the nice swim
    ts.match('(the|this|those|these) #Adjective [#Verb]').tag('Noun', 'the-adj-verb');
    //the truly nice swim
    ts.match('(the|this|those|these) #Adverb #Adjective [#Verb]').tag('Noun', 'correction-determiner4');
    //a stream runs
    ts.match('(the|this|a|an) [#Infinitive] #Adverb? #Verb').tag('Noun', 'correction-determiner5');
    //a sense of
    ts.match('#Determiner [#Verb] of').tag('Noun', 'the-verb-of');
    //the threat of force
    ts.match('#Determiner #Noun of [#Verb]').tag('Noun', 'noun-of-noun');
    //a close
    ts.match('#Determiner #Adverb? [close]').tag('Adjective', 'a-close');
    //did a 900, paid a 20
    ts.match('#Verb (a|an) [#Value]').tag('Singular', 'a-value');
    //a tv show
    ts.match('(a|an) #Noun [#Infinitive]').tag('Noun', 'a-noun-inf');
  }

  //like
  if (ts.has('like')) {
    ts.match('just [like]').tag('Preposition', 'like-preposition');
    //folks like her
    ts.match('#Noun [like] #Noun').tag('Preposition', 'noun-like');
    //look like
    ts.match('#Verb [like]').tag('Adverb', 'verb-like');
    //exactly like
    ts.match('#Adverb like').not('(really|generally|typically|usually|sometimes|often) like').lastTerm().tag('Adverb', 'adverb-like');
  }

  if (ts.has('#Value')) {
    //half a million
    ts.match('half a? #Value').tag('Value', 'half-a-value'); //quarter not ready
    ts.match('#Value and a (half|quarter)').tag('Value', 'value-and-a-half');
    //all values are either ordinal or cardinal
    // ts.match('#Value').match('!#Ordinal').tag('#Cardinal', 'not-ordinal');
    //money
    ts.match('#Value+ #Currency').tag('Money', 'value-currency').lastTerm().tag('Unit', 'money-unit');
    ts.match('#Money and #Money #Currency?').tag('Money', 'money-and-money');
    //1 800 PhoneNumber
    ts.match('1 #Value #PhoneNumber').tag('PhoneNumber', '1-800-Value');
    //(454) 232-9873
    ts.match('#NumericValue #PhoneNumber').tag('PhoneNumber', '(800) PhoneNumber');
    //two hundredth
    ts.match('#TextValue+').match('#Cardinal+ #Ordinal').tag('Ordinal', 'two-hundredth');
  }

  if (ts.has('#Noun')) {
    //'more' is not always an adverb
    ts.match('more #Noun').tag('Noun', 'more-noun');
    //the word 'second'
    ts.match('[second] #Noun').not('#Honorific').unTag('Unit').tag('Ordinal', 'second-noun');
    //he quickly foo
    ts.match('#Noun #Adverb [#Noun]').tag('Verb', 'correction');
    //fix for busted-up phrasalVerbs
    ts.match('#Noun [#Particle]').tag('Preposition', 'repair-noPhrasal');
    //John & Joe's
    ts.match('#Noun (&|n) #Noun').tag('Organization', 'Noun-&-Noun');
    //Aircraft designer
    ts.match('#Noun #Actor').tag('Actor', 'thing-doer');
    //this rocks
    ts.match('(this|that) [#Plural]').tag('PresentTense', 'this-verbs');
    //by a bear.
    ts.match('#Determiner #Infinitive$').lastTerm().tag('Noun', 'a-inf');
    //the western line
    ts.match('#Determiner [(western|eastern|northern|southern|central)] #Noun').tag('Noun', 'western-line');
    ts.match('(#Determiner|#Value) [(linear|binary|mobile|lexical|technical|computer|scientific|formal)] #Noun').tag('Noun', 'technical-noun');
    //organization
    if (ts.has('#Organization')) {
      ts.match('#Organization of the? #TitleCase').tag('Organization', 'org-of-place');
      ts.match('#Organization #Country').tag('Organization', 'org-country');
      ts.match('(world|global|international|national|#Demonym) #Organization').tag('Organization', 'global-org');
    }
    if (ts.has('#Possessive')) {
      //my buddy
      ts.match('#Possessive [#FirstName]').unTag('Person', 'possessive-name');
      //spencer kelly's
      ts.match('#FirstName #Acronym? #Possessive').notIf('#Comma').match('#FirstName #Acronym? #LastName').tag('Possessive');
      //Super Corp's fundraiser
      ts.match('#Organization+ #Possessive').notIf('#Comma').tag('Possessive');
      //Los Angeles's fundraiser
      ts.match('#Place+ #Possessive').notIf('#Comma').tag('Possessive');
    }
  }

  if (ts.has('#Verb')) {
    //still make
    ts.match('[still] #Verb').tag('Adverb', 'still-verb');
    //'u' as pronoun
    ts.match('[u] #Verb').tag('Pronoun', 'u-pronoun-1');
    //is no walk
    ts.match('is no [#Verb]').tag('Noun', 'is-no-verb');
    //different views than
    ts.match('[#Verb] than').tag('Noun', 'correction');
    //her polling
    ts.match('#Possessive [#Verb]').tag('Noun', 'correction-possessive');
    //there are reasons
    ts.match('there (are|were) #Adjective? [#PresentTense]').tag('Plural', 'there-are');

    if (ts.has('(who|what|where|why|how|when)')) {
      //the word 'how'
      ts.match('^how').tag('QuestionWord', 'how-question').tag('QuestionWord', 'how-question');
      ts.match('how (#Determiner|#Copula|#Modal|#PastTense)').term(0).tag('QuestionWord', 'how-is');
      // //the word 'which'
      ts.match('^which').tag('QuestionWord', 'which-question').tag('QuestionWord', 'which-question');
      ts.match('which . (#Noun)+ #Pronoun').term(0).tag('QuestionWord', 'which-question2');
      ts.match('which').tag('QuestionWord', 'which-question3');
      //where

      //how he is driving
      var word = ts.match('#QuestionWord #Noun #Copula #Adverb? (#Verb|#Adjective)').firstTerm();
      word.unTag('QuestionWord').tag('Conjunction', 'how-he-is-x');
      //when i go fishing
      word = ts.match('#QuestionWord #Noun #Adverb? #Infinitive not? #Gerund').firstTerm();
      word.unTag('QuestionWord').tag('Conjunction', 'when i go fishing');
    }
    if (ts.has('#Copula')) {
      //is eager to go
      ts.match('#Copula #Adjective to #Verb').match('#Adjective to').tag('Verb', 'correction');
      //is mark hughes
      ts.match('#Copula [#Infinitive] #Noun').tag('Noun', 'is-pres-noun');

      ts.match('[#Infinitive] #Copula').tag('Noun', 'infinitive-copula');
      //sometimes adverbs - 'pretty good','well above'
      ts.match('#Copula (pretty|dead|full|well) (#Adjective|#Noun)').notIf('#Comma').tag('#Copula #Adverb #Adjective', 'sometimes-adverb');
      //sometimes not-adverbs
      ts.match('#Copula [(just|alone)$]').tag('Adjective', 'not-adverb');
    }
    //went to sleep
    // ts.match('#Verb to #Verb').lastTerm().tag('Noun', 'verb-to-verb');
    //support a splattering of auxillaries before a verb
    var advb = '(#Adverb|not)+?';
    if (ts.has(advb)) {
      //had walked
      ts.match('(has|had) ' + advb + ' #PastTense').not('#Verb$').tag('Auxiliary', 'had-walked');
      //was walking
      ts.match('#Copula ' + advb + ' #Gerund').not('#Verb$').tag('Auxiliary', 'copula-walking');
      //been walking
      ts.match('(be|been) ' + advb + ' #Gerund').not('#Verb$').tag('Auxiliary', 'be-walking');
      //would walk
      ts.match('(#Modal|did) ' + advb + ' #Verb').not('#Verb$').tag('Auxiliary', 'modal-verb');
      //would have had
      ts.match('#Modal ' + advb + ' have ' + advb + ' had ' + advb + ' #Verb').not('#Verb$').tag('Auxiliary', 'would-have');
      //would be walking
      ts.match('(#Modal) ' + advb + ' be ' + advb + ' #Verb').not('#Verb$').tag('Auxiliary', 'would-be');
      //would been walking
      ts.match('(#Modal|had|has) ' + advb + ' been ' + advb + ' #Verb').not('#Verb$').tag('Auxiliary', 'would-be');
      //infinitive verbs suggest plural nouns - 'XYZ walk to the store'
      // r.match(`#Singular+ #Infinitive`).match('#Singular+').tag('Plural', 'infinitive-make-plural');
    }
    //fall over
    ts.match('#PhrasalVerb #PhrasalVerb').lastTerm().tag('Particle', 'phrasal-particle');
    if (ts.has('#Gerund')) {
      //walking is cool
      ts.match('#Gerund #Adverb? not? #Copula').firstTerm().tag('Activity', 'gerund-copula');
      //walking should be fun
      ts.match('#Gerund #Modal').firstTerm().tag('Activity', 'gerund-modal');
      //running-a-show
      ts.match('#Gerund #Determiner [#Infinitive]').tag('Noun', 'running-a-show');
      //setting records
      // ts.match('#Gerund [#PresentTense]').tag('Plural', 'setting-records');
    }
    //will be cool -> Copula
    if (ts.has('will #Adverb? not? #Adverb? be')) {
      //will be running (not copula
      if (ts.has('will #Adverb? not? #Adverb? be #Gerund') === false) {
        //tag it all
        ts.match('will not? be').tag('Copula', 'will-be-copula');
        //for more complex forms, just tag 'be'
        ts.match('will #Adverb? not? #Adverb? be #Adjective').match('be').tag('Copula', 'be-copula');
      }
    }
  }

  if (ts.has('#Adjective')) {
    //still good
    ts.match('still #Adjective').match('still').tag('Adverb', 'still-advb');
    //big dreams, critical thinking
    ts.match('#Adjective [#PresentTense]').tag('Noun', 'adj-presentTense');
    //will secure our
    ts.match('will [#Adjective]').tag('Verb', 'will-adj');
    //cheering hard - dropped -ly's
    ts.match('#PresentTense (hard|quick|long|bright|slow)').lastTerm().tag('Adverb', 'lazy-ly');
    //his fine
    ts.match('(his|her|its) [#Adjective]').tag('Noun', 'his-fine');
    //
    ts.match('#Noun #Adverb? [left]').tag('PastTense', 'left-verb');
  }

  if (ts.has('#TitleCase')) {
    //FitBit Inc
    ts.match('#TitleCase (ltd|co|inc|dept|assn|bros)').tag('Organization', 'org-abbrv');
    //Foo District
    ts.match('#TitleCase+ (district|region|province|county|prefecture|municipality|territory|burough|reservation)').tag('Region', 'foo-district');
    //District of Foo
    ts.match('(district|region|province|municipality|territory|burough|state) of #TitleCase').tag('Region', 'district-of-Foo');
  }

  if (ts.has('#Hyphenated')) {
    //air-flow
    ts.match('#Hyphenated #Hyphenated').match('#Noun #Verb').tag('Noun', 'hyphen-verb');
    var hyphen = ts.match('#Hyphenated+');
    if (hyphen.has('#Expression')) {
      //ooh-wee
      hyphen.tag('Expression', 'ooh-wee');
    }
  }

  if (ts.has('#Place')) {
    //West Norforlk
    ts.match('(west|north|south|east|western|northern|southern|eastern)+ #Place').tag('Region', 'west-norfolk');
    //some us-state acronyms (exlude: al, in, la, mo, hi, me, md, ok..)
    ts.match('#City [#Acronym]').match('(al|ak|az|ar|ca|ct|dc|fl|ga|id|il|nv|nh|nj|ny|oh|or|pa|sc|tn|tx|ut|vt|pr)').tag('Region', 'us-state');
  }
  //misc:
  //foot/feet
  ts.match('(foot|feet)').tag('Noun', 'foot-noun');
  ts.match('#Value (foot|feet)').term(1).tag('Unit', 'foot-unit');
  //'u' as pronoun
  ts.match('#Conjunction [u]').tag('Pronoun', 'u-pronoun-2');
  //'a/an' can mean 1 - "a hour"
  ts.match('(a|an) (#Duration|hundred|thousand|million|billion|trillion|quadrillion|quintillion|sextillion|septillion)').ifNo('#Plural').term(0).tag('Value', 'a-is-one');
  //swear-words as non-expression POS
  //nsfw
  ts.match('holy (shit|fuck|hell)').tag('Expression', 'swears-expression');
  ts.match('#Determiner (shit|damn|hell)').term(1).tag('Noun', 'swears-noun');
  ts.match('(shit|damn|fuck) (#Determiner|#Possessive|them)').term(0).tag('Verb', 'swears-verb');
  ts.match('#Copula fucked up?').not('#Copula').tag('Adjective', 'swears-adjective');
  //6 am
  ts.match('#Holiday (day|eve)').tag('Holiday', 'holiday-day');
  //timezones
  ts.match('(standard|daylight|summer|eastern|pacific|central|mountain) standard? time').tag('Time', 'timezone');
  //canadian dollar, Brazilian pesos
  ts.match('#Demonym #Currency').tag('Currency', 'demonym-currency');
  //about to go
  ts.match('about to #Adverb? #Verb').match('about to').tag(['Auxiliary', 'Verb'], 'about-to');
  //Doctor john smith jr
  ts.match('#Honorific #Person').tag('Person', 'honorific-person');
  ts.match('#Person (jr|sr|md)').tag('Person', 'person-honorific');
  //right of way
  ts.match('(right|rights) of .').tag('Noun', 'right-of');
  return ts;
};

module.exports = corrections;

},{}],122:[function(_dereq_,module,exports){
'use strict';

//a specificly-named thing, that should be capitalized
var properNoun = function properNoun(ts) {
  if (ts.has('#Person') === true) {
    ts.match('#FirstName #Person+').tag('ProperNoun');
    ts.match('#Person+ #LastName').tag('ProperNoun');
  }
  if (ts.has('#Place') === true) {
    ts.match('(#City|#Region|#Country)').tag('ProperNoun');
  }
  ts.match('#Organization').tag('ProperNoun');
  ts.match('#Month').tag('ProperNoun');
  return ts;
};
module.exports = properNoun;

},{}],123:[function(_dereq_,module,exports){
'use strict';

//patterns are .match() statements to be run after the tagger
var posthoc = function posthoc(ts) {
  var patterns = ts.world.patterns;
  Object.keys(patterns).forEach(function (k) {
    ts.match(k).tag(patterns[k], 'post-hoc: ' + k);
  });
  return ts;
};
module.exports = posthoc;

},{}],124:[function(_dereq_,module,exports){
'use strict';

var fixContraction = _dereq_('./fix');

var irregulars = {
  wanna: ['want', 'to'],
  gonna: ['going', 'to'],
  im: ['i', 'am'],
  alot: ['a', 'lot'],

  dont: ['do', 'not'],
  dun: ['do', 'not'],

  ive: ['i', 'have'],

  "won't": ['will', 'not'],
  wont: ['will', 'not'],

  "can't": ['can', 'not'],
  cant: ['can', 'not'],
  cannot: ['can', 'not'],

  // aint: ['is', 'not'], //or 'are'
  // "ain't": ['is', 'not'],
  "shan't": ['should', 'not'],
  imma: ['I', 'will'],

  "where'd": ['where', 'did'],
  whered: ['where', 'did'],
  "when'd": ['when', 'did'],
  whend: ['when', 'did'],
  "how'd": ['how', 'did'],
  howd: ['how', 'did'],
  "what'd": ['what', 'did'],
  whatd: ['what', 'did'],
  "let's": ['let', 'us'],

  //multiple word contractions
  dunno: ['do', 'not', 'know'],
  brb: ['be', 'right', 'back'],
  gtg: ['got', 'to', 'go'],
  irl: ['in', 'real', 'life'],
  tbh: ['to', 'be', 'honest'],
  imo: ['in', 'my', 'opinion'],
  til: ['today', 'i', 'learned'],
  rn: ['right', 'now'],
  twas: ['it', 'was'],
  '@': ['at']
};

//check irregulars
var checkIrregulars = function checkIrregulars(ts) {
  for (var i = 0; i < ts.terms.length; i++) {
    var t = ts.terms[i];
    if (irregulars[t.normal]) {
      var fix = irregulars[t.normal];
      ts = fixContraction(ts, fix, i);
      i += fix.length - 1;
    }
  }
  return ts;
};
module.exports = checkIrregulars;

},{"./fix":128}],125:[function(_dereq_,module,exports){
'use strict';

var fixContraction = _dereq_('./fix');
var splitContraction = _dereq_('./split');

//these are always contractions
var blacklist = {
  'that\'s': true,
  'there\'s': true
};
var are = {
  we: true,
  they: true,
  you: true
};

// "'s" may be a contraction or a possessive
// 'spencer's house' vs 'spencer's good'
var isPossessive = function isPossessive(ts, i) {
  var t = ts.terms[i];
  var next_t = ts.terms[i + 1];
  //a pronoun can't be possessive - "he's house"
  if (t.tags.Pronoun || t.tags.QuestionWord) {
    return false;
  }
  if (blacklist[t.normal]) {
    return false;
  }
  //if end of sentence, it is possessive - "was spencer's"
  if (!next_t) {
    return true;
  }
  //an infinitive is probably mis-tagged - 'jamie's bite'
  if (next_t.tags.Infinitive) {
    return true;
  }
  //a gerund suggests 'is walking'
  if (next_t.tags.VerbPhrase) {
    return false;
  }
  //spencer's house
  if (next_t.tags.Noun) {
    return true;
  }
  //rocket's red glare
  if (next_t.tags.Adjective && ts.terms[i + 2] && ts.terms[i + 2].tags.Noun) {
    return true;
  }
  //an adjective suggests 'is good'
  if (next_t.tags.Adjective || next_t.tags.Adverb || next_t.tags.Verb) {
    return false;
  }
  return false;
};

// you ain't / i ain't.
var isAre = function isAre(ts, i) {
  var arr = ['is', 'not']; //default
  //get what's it 'about'
  if (ts.terms[i - 1]) {
    var about = ts.terms[i - 1];
    //go back one more..
    if (about.tags.Adverb && ts.terms[i - 2]) {
      about = ts.terms[i - 2];
    }
    if (about.tags.Plural || are[about.normal] === true) {
      arr[0] = 'are';
    }
  }
  return arr;
};

//handle ambigous contraction "'s"
var hardOne = function hardOne(ts) {
  for (var i = 0; i < ts.terms.length; i++) {
    //skip existing
    if (ts.terms[i].silent_term) {
      continue;
    }
    if (ts.terms[i].normal === 'ain\'t' || ts.terms[i].normal === 'aint') {
      var arr = isAre(ts, i);
      ts = fixContraction(ts, arr, i);
      i += 1;
      continue;
    }
    var parts = splitContraction(ts.terms[i]);
    if (parts) {
      //have we found a hard one
      if (parts.end === 's') {
        //spencer's house
        if (isPossessive(ts, i)) {
          ts.terms[i].tag('#Possessive', 'hard-contraction');
          continue;
        }
        var _arr = [parts.start, 'is'];
        if (ts.terms[i + 1]) {
          var str = ts.terms[i].normal;
          //he's walking -> is/was
          if (ts.match(str + ' (#Negative|#Adverb|#Auxiliary)+? #Gerund').found) {
            _arr = [parts.start, 'is'];
          } else if (ts.match(str + ' (#Negative|#Adverb|#Auxiliary)+? #Verb').found) {
            //is vs has ('he's got milk')
            _arr = [parts.start, 'has'];
          }
        }
        ts = fixContraction(ts, _arr, i);
        i += 1;
      }
    }
  }
  return ts;
};

module.exports = hardOne;

},{"./fix":128,"./split":129}],126:[function(_dereq_,module,exports){
'use strict';

var fixContraction = _dereq_('./fix');
var split = _dereq_('./split');

//the formulaic contraction types:
var easy_ends = {
  ll: 'will',
  // 'd': 'would',
  ve: 'have',
  re: 'are',
  m: 'am',
  'n\'t': 'not'
  //these ones are a bit tricksier:
  // 't': 'not',
  // 's': 'is' //or was
};

//unambiguous contractions, like "'ll"
var easyOnes = function easyOnes(ts) {
  for (var i = 0; i < ts.terms.length; i++) {
    //skip existing
    if (ts.terms[i].silent_term) {
      continue;
    }
    var parts = split(ts.terms[i]);
    if (parts) {
      parts.start = parts.start.toLowerCase();

      //make sure its an easy one
      if (easy_ends[parts.end]) {
        var arr = [parts.start, easy_ends[parts.end]];
        ts = fixContraction(ts, arr, i);
        i += 1;
      }

      //handle i'd -> 'i would' vs 'i had'
      if (parts.end === 'd') {
        //assume 'would'
        var _arr = [parts.start, 'would'];
        //if next verb is past-tense, choose 'had'
        if (ts.terms[i + 1] && ts.terms[i + 1].tags.PastTense) {
          _arr[1] = 'had';
        }
        //also support '#Adverb #PastTense'
        if (ts.terms[i + 2] && ts.terms[i + 2].tags.PastTense && ts.terms[i + 1].tags.Adverb) {
          _arr[1] = 'had';
        }
        ts = fixContraction(ts, _arr, i);
        i += 1;
      }
    }
  }
  return ts;
};
module.exports = easyOnes;

},{"./fix":128,"./split":129}],127:[function(_dereq_,module,exports){
'use strict';

var fixContraction = _dereq_('./fix');
var Term = _dereq_('../../../term');

var hasDash = function hasDash(t) {
  var dashes = /(-|–|—)/;
  return dashes.test(t.whitespace.before) || dashes.test(t.whitespace.after);
};

var numberRange = function numberRange(ts) {
  //try to support number range, like 5-9, this way:
  ts.match('#Hyphenated #Hyphenated').match('#NumericValue #NumericValue').tag('NumberRange');
  //otherwise, loop through and find them
  for (var i = 0; i < ts.terms.length; i++) {
    var t = ts.terms[i];
    //skip existing
    if (t.silent_term) {
      continue;
    }
    if (t.tags.TextValue) {
      continue;
    }
    //hyphens found in whitespace - '5 - 7'
    if (t.tags.Value && ts.terms[i + 1] && i > 0 && (hasDash(t) || hasDash(ts.terms[i - 1])) && ts.terms[i - 1].tags.Value) {
      var to = new Term('', ts.world);
      to.silent_term = 'to';
      ts.insertAt(i, to);
      ts.terms[i - 1].tag('NumberRange', 'number-number1');
      ts.terms[i].tag('NumberRange', 'number-number2');
      ts.terms[i].whitespace.before = '';
      ts.terms[i].whitespace.after = '';
      ts.terms[i + 1].tag('NumberRange', 'number-number3');
      return ts;
    }
    //add a silent term
    if (t.tags.NumberRange) {
      var arr = t.text.split(/(-|–|—)/);
      arr[1] = 'to';
      ts = fixContraction(ts, arr, i);
      ts.terms[i].tag(['NumberRange', 'NumericValue'], 'numRange-1');
      ts.terms[i + 1].tag(['NumberRange', 'Preposition'], 'numRange-silent');
      ts.terms[i + 2].tag(['NumberRange', 'NumericValue'], 'numRange-3');
      i += 2;
    }
  }
  return ts;
};
module.exports = numberRange;

},{"../../../term":143,"./fix":128}],128:[function(_dereq_,module,exports){
'use strict';

var Term = _dereq_('../../../term');

var tags = {
  not: 'Negative',
  will: 'Verb',
  would: 'Modal',
  have: 'Verb',
  are: 'Copula',
  is: 'Copula',
  am: 'Verb'
};
//make sure the newly created term gets the easy tags
var easyTag = function easyTag(t) {
  if (tags[t.silent_term]) {
    t.tag(tags[t.silent_term]);
  }
};

//add a silent term
var fixContraction = function fixContraction(ts, parts, i) {
  //add the interpretation to the contracted term
  var one = ts.terms[i];
  one.silent_term = parts[0];
  //tag it as a contraction
  one.tag('Contraction', 'tagger-contraction');

  //add a new empty term
  if (parts[1]) {
    var two = new Term('', ts.world);
    two.silent_term = parts[1];
    two.tag('Contraction', 'tagger-contraction');
    ts.insertAt(i + 1, two);
    //ensure new term has no auto-whitspace
    two.whitespace.before = '';
    two.whitespace.after = '';
    easyTag(two);
  }

  //potentially it's three-contracted-terms, like 'dunno'
  if (parts[2]) {
    var three = new Term('', ts.world);
    three.silent_term = parts[2];
    // ts.terms.push(three);
    ts.insertAt(i + 2, three);
    three.tag('Contraction', 'tagger-contraction');
    easyTag(three);
  }

  return ts;
};

module.exports = fixContraction;

},{"../../../term":143}],129:[function(_dereq_,module,exports){
'use strict';

var contraction = /^([a-z]+)'([a-z][a-z]?)$/i;
var possessive = /[a-z]s'$/i;

var allowed = {
  re: 1,
  ve: 1,
  ll: 1,
  t: 1,
  s: 1,
  d: 1,
  m: 1
};

/** interpret a terms' contraction */
var splitContraction = function splitContraction(t) {
  //handle this irregular one (shared trailing n)
  if (t.normal === 'can\'t') {
    return {
      start: 'can',
      end: 'n\'t'
    };
  }
  var parts = t.normal.match(contraction);
  if (parts && parts[1] && allowed[parts[2]] === 1) {
    //handle n't
    if (parts[2] === 't' && parts[1].match(/[a-z]n$/)) {
      parts[1] = parts[1].replace(/n$/, '');
      parts[2] = 'n\'t'; //dunno..
    }
    //fix titlecase
    if (t.tags.TitleCase === true) {
      parts[1] = parts[1].replace(/^[a-z]/, function (x) {
        return x.toUpperCase();
      });
    }
    return {
      start: parts[1],
      end: parts[2]
    };
  }
  // "flanders' house"
  if (possessive.test(t.text) === true) {
    return {
      start: t.normal.replace(/s'?$/, ''),
      end: ''
    };
  }
  return null;
};
module.exports = splitContraction;

},{}],130:[function(_dereq_,module,exports){
"use strict";

//yep,
//https://github.com/mathiasbynens/emoji-regex/blob/master/index.js
module.exports = /(?:0\u20E3\n1\u20E3|2\u20E3|3\u20E3|4\u20E3|5\u20E3|6\u20E3|7\u20E3|8\u20E3|9\u20E3|#\u20E3|\*\u20E3|\uD83C(?:\uDDE6\uD83C(?:\uDDE8|\uDDE9|\uDDEA|\uDDEB|\uDDEC|\uDDEE|\uDDF1|\uDDF2|\uDDF4|\uDDF6|\uDDF7|\uDDF8|\uDDF9|\uDDFA|\uDDFC|\uDDFD|\uDDFF)|\uDDE7\uD83C(?:\uDDE6|\uDDE7|\uDDE9|\uDDEA|\uDDEB|\uDDEC|\uDDED|\uDDEE|\uDDEF|\uDDF1|\uDDF2|\uDDF3|\uDDF4|\uDDF6|\uDDF7|\uDDF8|\uDDF9|\uDDFB|\uDDFC|\uDDFE|\uDDFF)|\uDDE8\uD83C(?:\uDDE6|\uDDE8|\uDDE9|\uDDEB|\uDDEC|\uDDED|\uDDEE|\uDDF0|\uDDF1|\uDDF2|\uDDF3|\uDDF4|\uDDF5|\uDDF7|\uDDFA|\uDDFB|\uDDFC|\uDDFD|\uDDFE|\uDDFF)|\uDDE9\uD83C(?:\uDDEA|\uDDEC|\uDDEF|\uDDF0|\uDDF2|\uDDF4|\uDDFF)|\uDDEA\uD83C(?:\uDDE6|\uDDE8|\uDDEA|\uDDEC|\uDDED|\uDDF7|\uDDF8|\uDDF9|\uDDFA)|\uDDEB\uD83C(?:\uDDEE|\uDDEF|\uDDF0|\uDDF2|\uDDF4|\uDDF7)|\uDDEC\uD83C(?:\uDDE6|\uDDE7|\uDDE9|\uDDEA|\uDDEB|\uDDEC|\uDDED|\uDDEE|\uDDF1|\uDDF2|\uDDF3|\uDDF5|\uDDF6|\uDDF7|\uDDF8|\uDDF9|\uDDFA|\uDDFC|\uDDFE)|\uDDED\uD83C(?:\uDDF0|\uDDF2|\uDDF3|\uDDF7|\uDDF9|\uDDFA)|\uDDEE\uD83C(?:\uDDE8|\uDDE9|\uDDEA|\uDDF1|\uDDF2|\uDDF3|\uDDF4|\uDDF6|\uDDF7|\uDDF8|\uDDF9)|\uDDEF\uD83C(?:\uDDEA|\uDDF2|\uDDF4|\uDDF5)|\uDDF0\uD83C(?:\uDDEA|\uDDEC|\uDDED|\uDDEE|\uDDF2|\uDDF3|\uDDF5|\uDDF7|\uDDFC|\uDDFE|\uDDFF)|\uDDF1\uD83C(?:\uDDE6|\uDDE7|\uDDE8|\uDDEE|\uDDF0|\uDDF7|\uDDF8|\uDDF9|\uDDFA|\uDDFB|\uDDFE)|\uDDF2\uD83C(?:\uDDE6|\uDDE8|\uDDE9|\uDDEA|\uDDEB|\uDDEC|\uDDED|\uDDF0|\uDDF1|\uDDF2|\uDDF3|\uDDF4|\uDDF5|\uDDF6|\uDDF7|\uDDF8|\uDDF9|\uDDFA|\uDDFB|\uDDFC|\uDDFD|\uDDFE|\uDDFF)|\uDDF3\uD83C(?:\uDDE6|\uDDE8|\uDDEA|\uDDEB|\uDDEC|\uDDEE|\uDDF1|\uDDF4|\uDDF5|\uDDF7|\uDDFA|\uDDFF)|\uDDF4\uD83C\uDDF2|\uDDF5\uD83C(?:\uDDE6|\uDDEA|\uDDEB|\uDDEC|\uDDED|\uDDF0|\uDDF1|\uDDF2|\uDDF3|\uDDF7|\uDDF8|\uDDF9|\uDDFC|\uDDFE)|\uDDF6\uD83C\uDDE6|\uDDF7\uD83C(?:\uDDEA|\uDDF4|\uDDF8|\uDDFA|\uDDFC)|\uDDF8\uD83C(?:\uDDE6|\uDDE7|\uDDE8|\uDDE9|\uDDEA|\uDDEC|\uDDED|\uDDEE|\uDDEF|\uDDF0|\uDDF1|\uDDF2|\uDDF3|\uDDF4|\uDDF7|\uDDF8|\uDDF9|\uDDFB|\uDDFD|\uDDFE|\uDDFF)|\uDDF9\uD83C(?:\uDDE6|\uDDE8|\uDDE9|\uDDEB|\uDDEC|\uDDED|\uDDEF|\uDDF0|\uDDF1|\uDDF2|\uDDF3|\uDDF4|\uDDF7|\uDDF9|\uDDFB|\uDDFC|\uDDFF)|\uDDFA\uD83C(?:\uDDE6|\uDDEC|\uDDF2|\uDDF8|\uDDFE|\uDDFF)|\uDDFB\uD83C(?:\uDDE6|\uDDE8|\uDDEA|\uDDEC|\uDDEE|\uDDF3|\uDDFA)|\uDDFC\uD83C(?:\uDDEB|\uDDF8)|\uDDFD\uD83C\uDDF0|\uDDFE\uD83C(?:\uDDEA|\uDDF9)|\uDDFF\uD83C(?:\uDDE6|\uDDF2|\uDDFC)))|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2648-\u2653\u2660\u2663\u2665\u2666\u2668\u267B\u267F\u2692-\u2694\u2696\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD79\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED0\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3]|\uD83E[\uDD10-\uDD18\uDD80-\uDD84\uDDC0]/g;

},{}],131:[function(_dereq_,module,exports){
'use strict';

//just some of the most common emoticons
//faster than
//http://stackoverflow.com/questions/28077049/regex-matching-emoticons
module.exports = {
  ':(': true,
  ':)': true,
  ':P': true,
  ':p': true,
  ':O': true,
  ':3': true,
  ':|': true,
  ':/': true,
  ':\\': true,
  ':$': true,
  ':*': true,
  ':@': true,
  ':-(': true,
  ':-)': true,
  ':-P': true,
  ':-p': true,
  ':-O': true,
  ':-3': true,
  ':-|': true,
  ':-/': true,
  ':-\\': true,
  ':-$': true,
  ':-*': true,
  ':-@': true,
  ':^(': true,
  ':^)': true,
  ':^P': true,
  ':^p': true,
  ':^O': true,
  ':^3': true,
  ':^|': true,
  ':^/': true,
  ':^\\': true,
  ':^$': true,
  ':^*': true,
  ':^@': true,
  '):': true,
  '(:': true,
  '$:': true,
  '*:': true,
  ')-:': true,
  '(-:': true,
  '$-:': true,
  '*-:': true,
  ')^:': true,
  '(^:': true,
  '$^:': true,
  '*^:': true,
  '<3': true,
  '</3': true,
  '<\\3': true
};

},{}],132:[function(_dereq_,module,exports){
'use strict';
//markov-like stats about co-occurance, for hints about unknown terms
//basically, a little-bit better than the noun-fallback
//just top n-grams from nlp tags, generated from nlp-corpus

//after this word, here's what happens usually

var afterThisWord = {
  i: 'Verb', //44% //i walk..
  first: 'Noun', //50% //first principles..
  it: 'Verb', //33%
  there: 'Verb', //35%
  // to: 'Verb', //32%
  not: 'Verb', //33%
  because: 'Noun', //31%
  if: 'Noun', //32%
  but: 'Noun', //26%
  who: 'Verb', //40%
  this: 'Noun', //37%
  his: 'Noun', //48%
  when: 'Noun', //33%
  you: 'Verb', //35%
  very: 'Adjective', // 39%
  old: 'Noun', //51%
  never: 'Verb', //42%
  before: 'Noun' //28%
};

//in advance of this word, this is what happens usually
var beforeThisWord = {
  there: 'Verb', //23% // be there
  me: 'Verb', //31% //see me
  man: 'Adjective', // 80% //quiet man
  only: 'Verb', //27% //sees only
  him: 'Verb', //32% //show him
  were: 'Noun', //48% //we were
  // what: 'Verb', //25% //know what
  took: 'Noun', //38% //he took
  himself: 'Verb', //31% //see himself
  went: 'Noun', //43% //he went
  who: 'Noun', //47% //person who
  jr: 'Person'
};

//following this POS, this is likely
var afterThisPos = {
  Adjective: 'Noun', //36% //blue dress
  Possessive: 'Noun', //41% //his song
  Determiner: 'Noun', //47%
  Adverb: 'Verb', //20%
  // Person: 'Verb', //40%
  Pronoun: 'Verb', //40%
  Value: 'Noun', //47%
  Ordinal: 'Noun', //53%
  Modal: 'Verb', //35%
  Superlative: 'Noun', //43%
  Demonym: 'Noun', //38%
  // Organization: 'Verb', //33%
  Honorific: 'Person' //
  // FirstName: 'Person', //
};

//in advance of this POS, this is likely
var beforeThisPos = {
  Copula: 'Noun', //44% //spencer is
  PastTense: 'Noun', //33% //spencer walked
  Conjunction: 'Noun', //36%
  Modal: 'Noun', //38%
  PluperfectTense: 'Noun', //40%
  PerfectTense: 'Verb' //32%
  // LastName: 'FirstName', //
};
module.exports = {
  beforeThisWord: beforeThisWord,
  afterThisWord: afterThisWord,

  beforeThisPos: beforeThisPos,
  afterThisPos: afterThisPos
};

},{}],133:[function(_dereq_,module,exports){
'use strict';
//regex suffix patterns and their most common parts of speech,
//built using wordnet, by spencer kelly.
//this mapping shrinks-down the uglified build

var Adj = 'Adjective';
var Inf = 'Infinitive';
var Pres = 'PresentTense';
var Sing = 'Singular';
var Past = 'PastTense';
var Adverb = 'Adverb';
var Exp = 'Expression';
var Actor = 'Actor';
var Verb = 'Verb';
var Noun = 'Noun';
var Last = 'LastName';
//the order here matters.

//regexes indexed by mandated last-character
module.exports = {
  a: [[/.[aeiou]na$/, Noun], [/.[oau][wvl]ska$/, Last], //polish (female)
  [/.[^aeiou]ica$/, Sing], [/^([hyj]a)+$/, Exp] //hahah
  ],
  c: [[/.[^aeiou]ic$/, Adj]],
  d: [[/.[ia]sed$/, Adj], [/.[gt]led$/, Adj], [/.[aeiou][td]ed$/, Past], [/.[^aeiou]led$/, Past], //rumbled
  [/[^aeiou]ard$/, Sing], [/[aeiou][^aeiou]id$/, Adj], [/[aeiou]c?ked$/, Past], //hooked
  [/[^aeiou][aeiou][tvx]ed$/, Past], //boxed
  [/.[vrl]id$/, Adj]],
  e: [[/.[lnr]ize$/, Inf], [/.[^aeiou]ise$/, Inf], [/.[aeiou]te$/, Inf], [/.[^aeiou][ai]ble$/, Adj], [/.[^aeiou]eable$/, Adj], [/.[^aeiou]ive$/, Adj]],
  h: [[/.[^aeiouf]ish$/, Adj], [/.v[iy]ch$/, Last], //east-europe
  [/^ug?h+$/, Exp], //uhh
  [/^uh[ -]?oh$/, Exp] //uhoh
  ],
  i: [[/.[oau][wvl]ski$/, Last] //polish (male)
  ],
  k: [[/^(k)+$/, Exp] //kkkk
  ],
  l: [[/.[gl]ial$/, Adj], [/.[^aeiou]ful$/, Adj], [/.[nrtumcd]al$/, Adj], [/.[^aeiou][ei]al$/, Adj]],
  m: [[/.[^aeiou]ium$/, Sing], [/[^aeiou]ism$/, Sing], [/^h*u*m+$/, Exp], //mmmmmmm / ummmm / huuuuuummmmmm
  [/^\d+ ?[ap]m$/, 'Date']],
  n: [[/.[lsrnpb]ian$/, Adj], [/[^aeiou]ician$/, Actor]],
  o: [[/^no+$/, Exp], //noooo
  [/^(yo)+$/, Exp], //yoyo
  [/^woo+[pt]?$/, Exp] //woo
  ],
  r: [[/.[ilk]er$/, 'Comparative'], [/[aeiou][pns]er$/, Sing], [/[^i]fer$/, Inf], [/.[^aeiou][ao]pher$/, Actor]],
  t: [[/.[di]est$/, 'Superlative'], [/.[icldtgrv]ent$/, Adj], [/[aeiou].*ist$/, Adj], [/^[a-z]et$/, Verb]],
  s: [[/.[rln]ates$/, Pres], [/.[^z]ens$/, Verb], [/.[lstrn]us$/, Sing], [/[aeiou][^aeiou]is$/, Sing], [/[a-z]\'s$/, Noun], [/^yes+$/, Exp] //yessss
  ],
  v: [[/.[^aeiou][ai][kln]ov$/, Last] //east-europe
  ],
  y: [[/.[cts]hy$/, Adj], [/.[st]ty$/, Adj], [/.[gk]y$/, Adj], [/.[tnl]ary$/, Adj], [/.[oe]ry$/, Sing], [/[rdntkbhs]ly$/, Adverb], [/...lly$/, Adverb], [/[bszmp]{2}y$/, Adj], [/.(gg|bb|zz)ly$/, Adj], [/.[aeiou]my$/, Adj], [/[ea]{2}zy$/, Adj], [/.[^aeiou]ity$/, Sing]]
};

},{}],134:[function(_dereq_,module,exports){
'use strict';
//just a foolish lookup of known suffixes

var Adj = 'Adjective';
var Inf = 'Infinitive';
var Pres = 'PresentTense';
var Sing = 'Singular';
var Past = 'PastTense';
var Avb = 'Adverb';
var Plrl = 'Plural';
var Actor = 'Actor';
var Vb = 'Verb';
var Noun = 'Noun';
var Last = 'LastName';
var Modal = 'Modal';

module.exports = [null, //0
null, //1
{
  //2-letter
  ea: Sing,
  ia: Noun,
  ic: Adj,
  ly: Avb,
  '\'n': Vb,
  '\'t': Vb
}, {
  //3-letter
  que: Adj,
  lar: Adj,
  ike: Adj,
  ffy: Adj,
  nny: Adj,
  rmy: Adj,
  azy: Adj,
  oid: Adj,
  mum: Adj,
  ous: Adj,
  end: Vb,
  sis: Sing,
  rol: Sing,
  ize: Inf,
  ify: Inf,
  zes: Pres,
  nes: Pres,
  ing: 'Gerund', //likely to be converted to Adj after lexicon pass
  ' so': Avb,
  '\'ll': Modal,
  '\'re': 'Copula'
}, {
  //4-letter
  teen: 'Value',
  tors: Noun,
  amed: Past,
  ched: Past,
  ends: Vb,
  oses: Pres,
  fies: Pres,
  ects: Pres,
  nded: Past,
  cede: Inf,
  tage: Inf,
  gate: Inf,
  vice: Sing,
  tion: Sing,
  cted: Past,
  ette: Sing,
  some: Adj,
  llen: Adj,
  ried: Adj,
  gone: Adj,
  made: Adj,
  fore: Avb,
  less: Avb,
  ices: Plrl,
  ions: Plrl,
  ints: Plrl,
  aped: Past,
  lked: Past,
  ould: Modal,
  tive: Actor,
  sson: Last, //swedish male
  czyk: Last, //polish (male)
  chuk: Last, //east-europe
  enko: Last, //east-europe
  akis: Last, //greek
  nsen: Last //norway
}, {
  //5-letter
  fully: Avb,
  where: Avb,
  wards: Avb,
  urned: Past,
  tized: Past,
  eased: Past,
  ances: Plrl,
  tures: Plrl,
  ports: Plrl,
  ettes: Plrl,
  ities: Plrl,
  rough: Adj,
  bound: Adj,
  tieth: 'Ordinal',
  ishes: Pres,
  tches: Pres,
  nssen: Last, //norway
  marek: Last //polish (male)
}, {
  //6-letter
  keeper: Actor,
  logist: Actor,
  auskas: Last, //lithuania
  teenth: 'Value'
}, {
  //7-letter
  sdottir: Last, //swedish female
  opoulos: Last //greek
}];

},{}],135:[function(_dereq_,module,exports){
'use strict';
//add 'downward' tags (that immediately depend on this one)

var addDownword = function addDownword(tags) {
  var keys = Object.keys(tags);
  keys.forEach(function (k) {
    tags[k].downward = [];
    //look for tags with this as parent
    for (var i = 0; i < keys.length; i++) {
      if (tags[keys[i]].isA && tags[keys[i]].isA === k) {
        tags[k].downward.push(keys[i]);
      }
    }
  });
};
module.exports = addDownword;

},{}],136:[function(_dereq_,module,exports){
'use strict';

//list of inconsistent parts-of-speech

module.exports = [
//top-level pos are all inconsistent
['Noun', 'Verb', 'Adjective', 'Adverb', 'Determiner', 'Conjunction', 'Preposition', 'QuestionWord', 'Expression', 'Url', 'PhoneNumber', 'Email', 'Emoji'],
//exlusive-nouns
['Person', 'Organization', 'Value', 'Place', 'Actor', 'Demonym', 'Pronoun'],
//acronyms
['Acronym', 'Pronoun', 'Actor', 'Unit', 'Address'], ['Acronym', 'Plural'],
//things that can't be plural
['Plural', 'Singular'],
// ['Plural', 'Pronoun'],
// ['Plural', 'Person'],
// ['Plural', 'Organization'],
// ['Plural', 'Currency'],
// ['Plural', 'Ordinal'],
//exlusive-people
['MaleName', 'FemaleName'], ['FirstName', 'LastName', 'Honorific'],
//adjectives
['Comparative', 'Superlative'],
//values
['Value', 'Verb', 'Adjective'],
// ['Value', 'Year'],
['Ordinal', 'Cardinal'], ['TextValue', 'NumericValue'], ['NiceNumber', 'TextValue'], ['Ordinal', 'Currency'], //$5.50th
//verbs
['PastTense', 'PresentTense', 'FutureTense'], ['Pluperfect', 'Copula', 'Modal', 'Participle', 'Infinitive', 'Gerund', 'FuturePerfect', 'PerfectTense'], ['Auxiliary', 'Noun', 'Value'],
//date
['Month', 'WeekDay', 'Year', 'Duration', 'Holiday'], ['Particle', 'Conjunction', 'Adverb', 'Preposition'], ['Date', 'Verb', 'Adjective', 'Person'], ['Date', 'Money', 'RomanNumeral', 'Fraction'],
//a/an -> 1
['Value', 'Determiner'], ['Url', 'Value', 'HashTag', 'PhoneNumber', 'Emoji'],
//roman numerals
['RomanNumeral', 'Fraction', 'NiceNumber'], ['RomanNumeral', 'Money'],
//cases
['UpperCase', 'TitleCase', 'CamelCase'],
//phrases
['VerbPhrase', 'Noun', 'Adjective', 'Value'],
//QuestionWord
['QuestionWord', 'VerbPhrase'],
//acronyms
['Acronym', 'VerbPhrase']];

},{}],137:[function(_dereq_,module,exports){
'use strict';

var conflicts = _dereq_('./conflicts');
var nouns = _dereq_('./tags/nouns');
var verbs = _dereq_('./tags/verbs');
var values = _dereq_('./tags/values');
var dates = _dereq_('./tags/dates');
var misc = _dereq_('./tags/misc');
var addDownward = _dereq_('./addDownward');

//used for pretty-printing on the server-side
var colors = {
  Noun: 'blue',
  Date: 'red',
  Value: 'red',
  Verb: 'green',
  Auxiliary: 'green',
  Negative: 'green',
  VerbPhrase: 'green',
  Preposition: 'cyan',
  Condition: 'cyan',
  Conjunction: 'cyan',
  Determiner: 'cyan',
  Adjective: 'magenta',
  Adverb: 'cyan'
};

//extend tagset with new tags
var addIn = function addIn(obj, tags) {
  Object.keys(obj).forEach(function (k) {
    tags[k] = obj[k];
  });
};

//add tags to remove when tagging this one
var addConflicts = function addConflicts(tags) {
  Object.keys(tags).forEach(function (k) {
    tags[k].notA = {};
    for (var i = 0; i < conflicts.length; i++) {
      var arr = conflicts[i];
      if (arr.indexOf(k) !== -1) {
        arr = arr.filter(function (a) {
          return a !== k;
        });
        arr.forEach(function (e) {
          tags[k].notA[e] = true;
        });
      }
    }
    tags[k].notA = Object.keys(tags[k].notA);
  });
};

var addColors = function addColors(tags) {
  Object.keys(tags).forEach(function (k) {
    if (colors[k]) {
      tags[k].color = colors[k];
      return;
    }
    if (tags[k].isA && colors[tags[k].isA]) {
      tags[k].color = colors[tags[k].isA];
      return;
    }
    if (tags[k].isA && tags[tags[k].isA].color) {
      tags[k].color = tags[tags[k].isA].color;
    }
  });
};

var build = function build() {
  var tags = {};
  addIn(nouns, tags);
  addIn(verbs, tags);
  addIn(values, tags);
  addIn(dates, tags);
  addIn(misc, tags);
  //downstream
  addDownward(tags);
  //add enemies
  addConflicts(tags);
  //for nice-logging
  addColors(tags);
  return tags;
};
module.exports = build();

},{"./addDownward":135,"./conflicts":136,"./tags/dates":138,"./tags/misc":139,"./tags/nouns":140,"./tags/values":141,"./tags/verbs":142}],138:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  Date: {}, //not a noun, but usually is
  Month: {
    isA: 'Date',
    also: 'Singular'
  },
  WeekDay: {
    isA: 'Date',
    also: 'Noun'
  },
  RelativeDay: {
    isA: 'Date'
  },
  Year: {
    isA: 'Date'
  },
  Duration: {
    isA: 'Date',
    also: 'Noun'
  },
  Time: {
    isA: 'Date',
    also: 'Noun'
  },
  Holiday: {
    isA: 'Date',
    also: 'Noun'
  }
};

},{}],139:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  Adjective: {},
  Comparable: {
    isA: 'Adjective'
  },
  Comparative: {
    isA: 'Adjective'
  },
  Superlative: {
    isA: 'Adjective'
  },

  NumberRange: {
    isA: 'Contraction'
  },
  Adverb: {},

  Currency: {},
  //glue
  Determiner: {},
  Conjunction: {},
  Preposition: {},
  QuestionWord: {},
  RelativeProunoun: {
    isA: 'Pronoun'
  },
  Expression: {},
  Abbreviation: {},
  Url: {},
  PhoneNumber: {},
  HashTag: {},
  AtMention: {
    is: 'Noun'
  },
  Emoji: {},
  Email: {},

  //non-exclusive
  Condition: {},
  VerbPhrase: {},
  Auxiliary: {},
  Negative: {},
  Contraction: {},

  TitleCase: {},
  CamelCase: {},
  UpperCase: {},
  Hyphenated: {},
  Acronym: {},
  ClauseEnd: {},

  // Quotes
  Quotation: {},
  StartQuotation: {
    isA: 'Quotation'
  },
  EndQuotation: {
    isA: 'Quotation'
  },
  //parentheses
  Parentheses: {},
  EndBracket: {
    isA: 'Parentheses'
  },
  StartBracket: {
    isA: 'Parentheses'
  }
};

},{}],140:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  Noun: {},
  // - singular
  Singular: {
    isA: 'Noun'
  },
  //a specific thing that's capitalized
  ProperNoun: {
    isA: 'Noun'
  },

  // -- people
  Person: {
    isA: 'Singular'
  },
  FirstName: {
    isA: 'Person'
  },
  MaleName: {
    isA: 'FirstName'
  },
  FemaleName: {
    isA: 'FirstName'
  },
  LastName: {
    isA: 'Person'
  },
  Honorific: {
    isA: 'Noun'
  },
  Place: {
    isA: 'Singular'
  },

  // -- places
  Country: {
    isA: 'Place'
  },
  City: {
    isA: 'Place'
  },
  Region: {
    isA: 'Place'
  },
  Address: {
    isA: 'Place'
  },
  Organization: {
    isA: 'Singular'
  },
  SportsTeam: {
    isA: 'Organization'
  },
  Company: {
    isA: 'Organization'
  },
  School: {
    isA: 'Organization'
  },

  // - plural
  Plural: {
    isA: 'Noun'
  },
  Uncountable: {
    //(not plural or singular)
    isA: 'Noun'
  },
  Pronoun: {
    isA: 'Noun'
  },
  //a word for someone doing something -'plumber'
  Actor: {
    isA: 'Noun'
  },
  //a gerund-as-noun - 'swimming'
  Activity: {
    isA: 'Noun'
  },
  //'kilograms'
  Unit: {
    isA: 'Noun'
  },
  //'Canadians'
  Demonym: {
    isA: 'Noun'
  },
  //`john's`
  Possessive: {
    isA: 'Noun'
  }
};

},{}],141:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  Value: {},
  Ordinal: {
    isA: 'Value'
  },
  Cardinal: {
    isA: 'Value'
  },
  Multiple: {
    isA: 'Value'
  },
  RomanNumeral: {
    isA: 'Cardinal'
  },
  Fraction: {
    isA: 'Value'
  },
  TextValue: {
    isA: 'Value'
  },
  NumericValue: {
    isA: 'Value'
  },
  NiceNumber: {
    isA: 'Value'
  },
  Money: {
    //isA: 'Cardinal'
  },
  Percent: {
    isA: 'Value'
  }
};

},{}],142:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  Verb: {
    isA: 'VerbPhrase'
  },
  PresentTense: {
    isA: 'Verb'
  },
  Infinitive: {
    isA: 'PresentTense'
  },
  Gerund: {
    isA: 'PresentTense'
  },
  PastTense: {
    isA: 'Verb'
  },
  PerfectTense: {
    isA: 'Verb'
  },
  FuturePerfect: {
    isA: 'Verb'
  },
  Pluperfect: {
    isA: 'Verb'
  },
  Copula: {
    isA: 'Verb'
  },
  Modal: {
    isA: 'Verb'
  },
  Participle: {
    isA: 'Verb'
  },
  Particle: {
    isA: 'Verb'
  },
  PhrasalVerb: {
    isA: 'Verb'
  }
};

},{}],143:[function(_dereq_,module,exports){
'use strict';

var fns = _dereq_('./paths').fns;
var build_whitespace = _dereq_('./whitespace');
var makeUID = _dereq_('./makeUID');
//normalization
var addNormal = _dereq_('./methods/normalize/normalize').addNormal;
var addRoot = _dereq_('./methods/normalize/root');

var Term = function Term(str, world) {
  this.tags = {};
  this._text = fns.ensureString(str);

  // this.world = world;
  Object.defineProperty(this, 'world', {
    enumerable: false, // hide it from for..in
    value: world
  });
  // this.world = function() {
  //   return world;
  // };
  //seperate whitespace from the text
  var parsed = build_whitespace(this._text);
  this.whitespace = parsed.whitespace;
  this._text = parsed.text;
  this.parent = null;
  this.silent_term = '';
  this.lumped = false;
  //normalize the _text
  addNormal(this);
  addRoot(this);
  //has this term been modified
  this.dirty = false;
  //make a unique id for this term
  this.uid = makeUID(this.normal);

  //getters/setters
  Object.defineProperty(this, 'text', {
    get: function get() {
      return this._text;
    },
    set: function set(txt) {
      txt = txt || '';
      this._text = txt.trim();
      this.dirty = true;
      // if (this._text !== txt) {
      //   console.log('|' + txt + '|');
      // console.log(build_whitespace(txt));
      // this.whitespace = build_whitespace(txt);
      //   console.log(this.whitespace);
      // }
      this.normalize();
    }
  });
  //bit faster than .constructor.name or w/e
  Object.defineProperty(this, 'isA', {
    get: function get() {
      return 'Term';
    }
  });
};

/**run each time a new text is set */
Term.prototype.normalize = function () {
  addNormal(this);
  addRoot(this);
  return this;
};
/** where in the sentence is it? zero-based. */
Term.prototype.index = function () {
  var ts = this.parentTerms;
  if (!ts) {
    return null;
  }
  return ts.terms.indexOf(this);
};
/** make a copy with no originals to the original  */
Term.prototype.clone = function () {
  var term = new Term(this._text, this.world);
  term.tags = fns.copy(this.tags);
  term.whitespace = fns.copy(this.whitespace);
  term.silent_term = this.silent_term;
  return term;
};

_dereq_('./methods/misc')(Term);
_dereq_('./methods/out')(Term);
_dereq_('./methods/tag')(Term);
_dereq_('./methods/case')(Term);
_dereq_('./methods/punctuation')(Term);

module.exports = Term;

},{"./makeUID":144,"./methods/case":146,"./methods/misc":147,"./methods/normalize/normalize":149,"./methods/normalize/root":150,"./methods/out":153,"./methods/punctuation":156,"./methods/tag":158,"./paths":161,"./whitespace":162}],144:[function(_dereq_,module,exports){
'use strict';
//this is a not-well-thought-out way to reduce our dependence on `object===object` original stuff
//generates a unique id for this term
//may need to change when the term really-transforms? not sure.

var uid = function uid(str) {
  var nums = '';
  for (var i = 0; i < 5; i++) {
    nums += parseInt(Math.random() * 9, 10);
  }
  return str + '-' + nums;
};
module.exports = uid;

},{}],145:[function(_dereq_,module,exports){
'use strict';
// const tagSet = require('../paths').tags;

var boringTags = {
  Auxiliary: 1,
  Possessive: 1,
  TitleCase: 1,
  ClauseEnd: 1,
  Comma: 1,
  CamelCase: 1,
  UpperCase: 1,
  Hyphenated: 1,
  VerbPhrase: 1,
  EndBracket: 1,
  StartBracket: 1,
  Parentheses: 1,
  Quotation: 1
};

var bestTag = function bestTag(t) {
  var tagSet = t.world.tags;
  var tags = Object.keys(t.tags);
  tags = tags.sort(); //alphabetical, first
  //then sort by #of parent tags
  tags = tags.sort(function (a, b) {
    //bury the tags we dont want
    if (!tagSet[a]) {
      return 1;
    }
    if (boringTags[b] || !tagSet[b]) {
      return -1;
    }
    if (tagSet[a].downward.length > tagSet[b].downward.length) {
      return 1;
    }
    return 1;
  });
  return tags[0];
};
module.exports = bestTag;

},{}],146:[function(_dereq_,module,exports){
'use strict';

var addMethods = function addMethods(Term) {
  var methods = {
    toUpperCase: function toUpperCase() {
      this.text = this._text.toUpperCase();
      this.tag('#UpperCase', 'toUpperCase');
      return this;
    },
    toLowerCase: function toLowerCase() {
      this.text = this._text.toLowerCase();
      this.unTag('#TitleCase');
      this.unTag('#UpperCase');
      return this;
    },
    toTitleCase: function toTitleCase() {
      this.text = this._text.replace(/^ *[a-z]/, function (x) {
        return x.toUpperCase();
      });
      this.tag('#TitleCase', 'toTitleCase');
      return this;
    },
    //(camelCase() is handled in `./terms` )

    /** is it titlecased because it deserves it? Like a person's name? */
    needsTitleCase: function needsTitleCase() {
      var titleCases = ['Person', 'Place', 'Organization', 'Acronym', 'UpperCase', 'Currency', 'RomanNumeral', 'Month', 'WeekDay', 'Holiday', 'Demonym'];
      for (var i = 0; i < titleCases.length; i++) {
        if (this.tags[titleCases[i]]) {
          return true;
        }
      }
      //specific words that keep their titlecase
      //https://en.wikipedia.org/wiki/Capitonym
      var irregulars = ['i', 'god', 'allah'];
      for (var _i = 0; _i < irregulars.length; _i++) {
        if (this.normal === irregulars[_i]) {
          return true;
        }
      }
      return false;
    }
  };
  //hook them into result.proto
  Object.keys(methods).forEach(function (k) {
    Term.prototype[k] = methods[k];
  });
  return Term;
};

module.exports = addMethods;

},{}],147:[function(_dereq_,module,exports){
'use strict';

var _isAcronym = _dereq_('./normalize/isAcronym');
var _bestTag = _dereq_('./bestTag');

//regs-
var hasVowel = /[aeiouy]/i;
var hasLetter = /[a-z]/;
var hasNumber = /[0-9]/;

var addMethods = function addMethods(Term) {

  var methods = {
    /** which tag best-represents this term?*/
    bestTag: function bestTag() {
      return _bestTag(this);
    },

    /** is this term like F.B.I. or NBA */
    isAcronym: function isAcronym() {
      return _isAcronym(this._text);
    },
    /** check if it is word-like in english */
    isWord: function isWord() {
      var t = this;
      //assume a contraction produces a word-word
      if (t.silent_term) {
        return true;
      }
      //no letters or numbers
      if (/[a-z|A-Z|0-9]/.test(t.text) === false) {
        return false;
      }
      //has letters, but with no vowels
      if (t.normal.length > 3 && hasLetter.test(t.normal) === true && hasVowel.test(t.normal) === false && t.isAcronym() === false) {
        return false;
      }
      //has numbers but not a 'value'
      if (hasNumber.test(t.normal) === true && t.tags.hasOwnProperty('Value') === false) {
        //s4e
        if (/[a-z][0-9][a-z]/.test(t.normal) === true) {
          return false;
        }
        //ensure it looks like a 'value' eg '-$4,231.00'
        // if (/^([$-])*?([0-9,\.])*?([s\$%])*?$/.test(t.normal) === false) {
        //   return false;
        // }
      }
      return true;
    }
  };
  //hook them into result.proto
  Object.keys(methods).forEach(function (k) {
    Term.prototype[k] = methods[k];
  });
  return Term;
};

module.exports = addMethods;

},{"./bestTag":145,"./normalize/isAcronym":148}],148:[function(_dereq_,module,exports){
'use strict';
//regs -

var periodAcronym = /([A-Z]\.)+[A-Z]?,?$/;
var oneLetterAcronym = /^[A-Z]\.,?$/;
var noPeriodAcronym = /[A-Z]{2}('s|,)?$/;

/** does it appear to be an acronym, like FBI or M.L.B. */
var isAcronym = function isAcronym(str) {
  //like N.D.A
  if (periodAcronym.test(str) === true) {
    return true;
  }
  //like 'F.'
  if (oneLetterAcronym.test(str) === true) {
    return true;
  }
  //like NDA
  if (noPeriodAcronym.test(str) === true) {
    return true;
  }
  return false;
};
module.exports = isAcronym;

},{}],149:[function(_dereq_,module,exports){
'use strict';

var killUnicode = _dereq_('./unicode');
var isAcronym = _dereq_('./isAcronym');

//some basic operations on a string to reduce noise
exports.normalize = function (str) {
  str = str || '';
  str = str.toLowerCase();
  str = str.trim();
  var original = str;
  //(very) rough ASCII transliteration -  bjŏrk -> bjork
  str = killUnicode(str);
  //#tags, @mentions
  str = str.replace(/^[#@]/, '');
  //punctuation
  str = str.replace(/[,;.!?]+$/, '');
  // coerce single curly quotes
  str = str.replace(/[\u0027\u0060\u00B4\u2018\u2019\u201A\u201B\u2032\u2035\u2039\u203A]+/g, '\'');
  // coerce double curly quotes
  str = str.replace(/[\u0022\u00AB\u00BB\u201C\u201D\u201E\u201F\u2033\u2034\u2036\u2037\u2E42\u301D\u301E\u301F\uFF02]+/g, '"');
  //coerce Unicode ellipses
  str = str.replace(/\u2026/g, '...');
  //en-dash
  str = str.replace(/\u2013/g, '-');
  //lookin'->looking (make it easier for conjugation)
  if (/[a-z][^aeiou]in['’]$/.test(str) === true) {
    str = str.replace(/in['’]$/, 'ing');
  }
  //turn re-enactment to reenactment
  if (/^(re|un)-?[^aeiou]./.test(str) === true) {
    str = str.replace('-', '');
  }
  //strip leading & trailing grammatical punctuation
  if (/^[:;]/.test(str) === false) {
    str = str.replace(/\.{3,}$/g, '');
    str = str.replace(/['",\.!:;\?\)]+$/g, '');
    str = str.replace(/^['"\(]+/g, '');
  }
  //do this again..
  str = str.trim();
  //oh shucks,
  if (str === '') {
    str = original;
  }
  return str;
};

exports.addNormal = function (term) {
  var str = term._text || '';
  str = exports.normalize(str);
  //compact acronyms
  if (isAcronym(term._text)) {
    str = str.replace(/\./g, '');
  }
  //nice-numbers
  str = str.replace(/([0-9]),([0-9])/g, '$1$2');
  term.normal = str;
};

// console.log(normalize('Dr. V Cooper'));

},{"./isAcronym":148,"./unicode":151}],150:[function(_dereq_,module,exports){
'use strict';
//

var rootForm = function rootForm(term) {
  var str = term.normal || term.silent_term || '';
  //handle apostrophes and stuff (go further than normalize())
  str = str.replace(/'s\b/, '');
  str = str.replace(/'$/, '');
  term.root = str;
};

module.exports = rootForm;

},{}],151:[function(_dereq_,module,exports){
'use strict';
//a hugely-ignorant, and widely subjective transliteration of latin, cryllic, greek unicode characters to english ascii.
//approximate visual (not semantic or phonetic) relationship between unicode and ascii characters
//http://en.wikipedia.org/wiki/List_of_Unicode_characters
//https://docs.google.com/spreadsheet/ccc?key=0Ah46z755j7cVdFRDM1A2YVpwa1ZYWlpJM2pQZ003M0E

var compact = {
  '!': '¡',
  '?': '¿Ɂ',
  '"': '“”"❝❞',
  '\'': '‘‛❛❜',
  '-': '—–',
  'a': 'ªÀÁÂÃÄÅàáâãäåĀāĂăĄąǍǎǞǟǠǡǺǻȀȁȂȃȦȧȺΆΑΔΛάαλАДадѦѧӐӑӒӓƛɅæ',
  'b': 'ßþƀƁƂƃƄƅɃΒβϐϦБВЪЬбвъьѢѣҌҍҔҕƥƾ',
  'c': '¢©ÇçĆćĈĉĊċČčƆƇƈȻȼͻͼͽϲϹϽϾϿЄСсєҀҁҪҫ',
  'd': 'ÐĎďĐđƉƊȡƋƌǷ',
  'e': 'ÈÉÊËèéêëĒēĔĕĖėĘęĚěƎƏƐǝȄȅȆȇȨȩɆɇΈΕΞΣέεξϱϵ϶ЀЁЕЭеѐёҼҽҾҿӖӗӘәӚӛӬӭ',
  'f': 'ƑƒϜϝӺӻҒғӶӷſ',
  'g': 'ĜĝĞğĠġĢģƓǤǥǦǧǴǵ',
  'h': 'ĤĥĦħƕǶȞȟΉΗЂЊЋНнђћҢңҤҥҺһӉӊ',
  'I': 'ÌÍÎÏ',
  'i': 'ìíîïĨĩĪīĬĭĮįİıƖƗȈȉȊȋΊΐΪίιϊІЇії',
  'j': 'ĴĵǰȷɈɉϳЈј',
  'k': 'ĶķĸƘƙǨǩΚκЌЖКжкќҚқҜҝҞҟҠҡ',
  'l': 'ĹĺĻļĽľĿŀŁłƚƪǀǏǐȴȽΙӀӏ',
  'm': 'ΜϺϻМмӍӎ',
  'n': 'ÑñŃńŅņŇňŉŊŋƝƞǸǹȠȵΝΠήηϞЍИЙЛПийлпѝҊҋӅӆӢӣӤӥπ',
  'o': 'ÒÓÔÕÖØðòóôõöøŌōŎŏŐőƟƠơǑǒǪǫǬǭǾǿȌȍȎȏȪȫȬȭȮȯȰȱΌΘΟθοσόϕϘϙϬϭϴОФоѲѳӦӧӨөӪӫ¤ƍΏ',
  'p': 'ƤƿΡρϷϸϼРрҎҏÞ',
  'q': 'Ɋɋ',
  'r': 'ŔŕŖŗŘřƦȐȑȒȓɌɍЃГЯгяѓҐґ',
  's': 'ŚśŜŝŞşŠšƧƨȘșȿςϚϛϟϨϩЅѕ',
  't': 'ŢţŤťŦŧƫƬƭƮȚțȶȾΓΤτϮϯТт҂Ҭҭ',
  'u': 'µÙÚÛÜùúûüŨũŪūŬŭŮůŰűŲųƯưƱƲǓǔǕǖǗǘǙǚǛǜȔȕȖȗɄΰμυϋύϑЏЦЧцџҴҵҶҷӋӌӇӈ',
  'v': 'νѴѵѶѷ',
  'w': 'ŴŵƜωώϖϢϣШЩшщѡѿ',
  'x': '×ΧχϗϰХхҲҳӼӽӾӿ',
  'y': 'ÝýÿŶŷŸƳƴȲȳɎɏΎΥΫγψϒϓϔЎУучўѰѱҮүҰұӮӯӰӱӲӳ',
  'z': 'ŹźŻżŽžƩƵƶȤȥɀΖζ'
};
//decompress data into two hashes
var unicode = {};
Object.keys(compact).forEach(function (k) {
  compact[k].split('').forEach(function (s) {
    unicode[s] = k;
  });
});

var killUnicode = function killUnicode(str) {
  var chars = str.split('');
  chars.forEach(function (s, i) {
    if (unicode[s]) {
      chars[i] = unicode[s];
    }
  });
  return chars.join('');
};
module.exports = killUnicode;
// console.log(killUnicode('bjŏȒk—Ɏó'));

},{}],152:[function(_dereq_,module,exports){
'use strict';

var paths = _dereq_('../../paths');
var fns = paths.fns;
var tagset = paths.tags;

//a nicer logger for the client-side
var clientSide = function clientSide(t) {
  var color = 'silver';
  var tags = Object.keys(t.tags);
  for (var i = 0; i < tags.length; i++) {
    if (tagset[tags[i]] && tagset[tags[i]].color) {
      color = tagset[tags[i]].color;
      break;
    }
  }
  var word = fns.leftPad(t.text, 12);
  word += ' ' + tags;
  console.log('%c ' + word, 'color: ' + color);
};
module.exports = clientSide;

},{"../../paths":161}],153:[function(_dereq_,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var renderHtml = _dereq_('./renderHtml');
var clientDebug = _dereq_('./client');
var serverDebug = _dereq_('./server');

var methods = {
  /** a pixel-perfect reproduction of the input, with whitespace preserved */
  text: function text(r) {
    return (r.whitespace.before || '') + r._text + (r.whitespace.after || '');
  },
  /** a lowercased, punctuation-cleaned, whitespace-trimmed version of the word */
  normal: function normal(r) {
    return r.normal;
  },
  /** even-more normalized than normal */
  root: function root(r) {
    return r.root || r.normal;
  },
  /** the &encoded term in a span element, with POS as classNames */
  html: function html(r) {
    return renderHtml(r);
  },
  /** a simplified response for Part-of-Speech tagging*/
  tags: function tags(r) {
    return {
      text: r.text,
      normal: r.normal,
      tags: Object.keys(r.tags)
    };
  },
  /** check-print information for the console */
  debug: function debug(t) {
    if ((typeof window === 'undefined' ? 'undefined' : _typeof(window)) === 'object') {
      clientDebug(t);
    } else {
      serverDebug(t);
    }
  }
};

var addMethods = function addMethods(Term) {
  //hook them into result.proto
  Term.prototype.out = function (fn) {
    if (!methods[fn]) {
      fn = 'text';
    }
    return methods[fn](this);
  };
  return Term;
};

module.exports = addMethods;

},{"./client":152,"./renderHtml":154,"./server":155}],154:[function(_dereq_,module,exports){
'use strict';
//turn xml special characters into apersand-encoding.
//i'm not sure this is perfectly safe.

var escapeHtml = function escapeHtml(s) {
  var HTML_CHAR_MAP = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    '\'': '&#39;',
    ' ': '&nbsp;'
  };
  return s.replace(/[<>&"' ]/g, function (ch) {
    return HTML_CHAR_MAP[ch];
  });
};

//remove html elements already in the text
//not tested!
//http://stackoverflow.com/questions/295566/sanitize-rewrite-html-on-the-client-side
var sanitize = function sanitize(html) {
  var tagBody = '(?:[^"\'>]|"[^"]*"|\'[^\']*\')*';
  var tagOrComment = new RegExp('<(?:'
  // Comment body.
  + '!--(?:(?:-*[^->])*--+|-?)'
  // Special "raw text" elements whose content should be elided.
  + '|script\\b' + tagBody + '>[\\s\\S]*?</script\\s*' + '|style\\b' + tagBody + '>[\\s\\S]*?</style\\s*'
  // Regular name
  + '|/?[a-z]' + tagBody + ')>', 'gi');
  var oldHtml = void 0;
  do {
    oldHtml = html;
    html = html.replace(tagOrComment, '');
  } while (html !== oldHtml);
  return html.replace(/</g, '&lt;');
};

//turn the term into ~properly~ formatted html
var renderHtml = function renderHtml(t) {
  var classes = Object.keys(t.tags).filter(function (tag) {
    return tag !== 'Term';
  });
  classes = classes.map(function (c) {
    return 'nl-' + c;
  });
  classes = classes.join(' ');
  var text = sanitize(t.text);
  text = escapeHtml(text);
  var el = '<span class="' + classes + '">' + text + '</span>';
  return escapeHtml(t.whitespace.before) + el + escapeHtml(t.whitespace.after);
};

module.exports = renderHtml;

},{}],155:[function(_dereq_,module,exports){
'use strict';

var fns = _dereq_('../../paths').fns;

//pretty-print a term on the nodejs console
var serverDebug = function serverDebug(t) {
  var tags = Object.keys(t.tags).map(function (tag) {
    return fns.printTag(tag);
  }).join(', ');
  var word = t.text;
  word = '\'' + fns.yellow(word || '-') + '\'';
  var silent = '';
  if (t.silent_term) {
    silent = '[' + t.silent_term + ']';
  }
  word = fns.leftPad(word, 20);
  word += fns.leftPad(silent, 8);
  console.log('   ' + word + '   ' + '     - ' + tags);
};
module.exports = serverDebug;

},{"../../paths":161}],156:[function(_dereq_,module,exports){
'use strict';
// const endPunct = /([^\/,:;.()!?]{0,1})([\/,:;.()!?]+)$/i;

var endPunct = /([a-z0-9 ])([,:;.!?]+)$/i; //old

var addMethods = function addMethods(Term) {
  var methods = {
    /** the punctuation at the end of this term*/
    getPunctuation: function getPunctuation() {
      var m = this.text.match(endPunct);
      if (m) {
        return m[2];
      }
      return null;
    },

    setPunctuation: function setPunctuation(punct) {
      this.killPunctuation();
      this.text += punct;
      if (punct === ',') {
        this.tags.Comma = true;
      }
      return this;
    },

    /** check if the term ends with a comma */
    hasComma: function hasComma() {
      if (this.getPunctuation() === ',') {
        return true;
      }
      return false;
    },

    killPunctuation: function killPunctuation() {
      this.text = this._text.replace(endPunct, '$1');
      delete this.tags.Comma;
      delete this.tags.ClauseEnd;
      return this;
    }
  };
  //hook them into result.proto
  Object.keys(methods).forEach(function (k) {
    Term.prototype[k] = methods[k];
  });
  return Term;
};

module.exports = addMethods;

},{}],157:[function(_dereq_,module,exports){
'use strict';

//recursively-check compatibility of this tag and term

var canBe = function canBe(term, tag) {
  var tagset = term.world.tags;
  //fail-fast
  if (tagset[tag] === undefined) {
    return true;
  }
  //loop through tag's contradictory tags
  var enemies = tagset[tag].notA || [];
  for (var i = 0; i < enemies.length; i++) {
    if (term.tags[enemies[i]] === true) {
      return false;
    }
  }
  if (tagset[tag].isA !== undefined) {
    return canBe(term, tagset[tag].isA); //recursive
  }
  return true;
};

module.exports = canBe;

},{}],158:[function(_dereq_,module,exports){
'use strict';

var setTag = _dereq_('./setTag');
var _unTag = _dereq_('./unTag');
var _canBe = _dereq_('./canBe');

//symbols used in sequential taggers which mean 'do nothing'
//.tag('#Person #Place . #City')
var ignore = {
  '.': true
};
var addMethods = function addMethods(Term) {

  var methods = {
    /** set the term as this part-of-speech */
    tag: function tag(_tag, reason) {
      if (ignore[_tag] !== true) {
        setTag(this, _tag, reason);
      }
    },
    /** remove this part-of-speech from the term*/
    unTag: function unTag(tag, reason) {
      if (ignore[tag] !== true) {
        _unTag(this, tag, reason);
      }
    },
    /** is this tag compatible with this word */
    canBe: function canBe(tag) {
      tag = tag || '';
      if (typeof tag === 'string') {
        //everything can be '.'
        if (ignore[tag] === true) {
          return true;
        }
        tag = tag.replace(/^#/, '');
      }
      return _canBe(this, tag);
    }
  };

  //hook them into term.prototype
  Object.keys(methods).forEach(function (k) {
    Term.prototype[k] = methods[k];
  });
  return Term;
};

module.exports = addMethods;

},{"./canBe":157,"./setTag":159,"./unTag":160}],159:[function(_dereq_,module,exports){
'use strict';
//set a term as a particular Part-of-speech

var path = _dereq_('../../paths');
var log = path.log;
var fns = path.fns;
var unTag = _dereq_('./unTag');
// const tagset = path.tags;
// const tagset = require('../../../tagset');

var putTag = function putTag(term, tag, reason) {
  var tagset = term.world.tags;
  tag = tag.replace(/^#/, '');
  //already got this
  if (term.tags[tag] === true) {
    return;
  }
  term.tags[tag] = true;
  log.tag(term, tag, reason);

  //extra logic per-each POS
  if (tagset[tag]) {
    //drop any conflicting tags
    var enemies = tagset[tag].notA || [];
    for (var i = 0; i < enemies.length; i++) {
      if (term.tags[enemies[i]] === true) {
        unTag(term, enemies[i], reason);
      }
    }
    //apply implicit tags
    if (tagset[tag].isA) {
      var doAlso = tagset[tag].isA;
      if (term.tags[doAlso] !== true) {
        putTag(term, doAlso, ' --> ' + tag); //recursive
      }
    }
  }
};

//give term this tag
var wrap = function wrap(term, tag, reason) {
  if (!term || !tag) {
    return;
  }
  var tagset = term.world.tags;
  //handle multiple tags
  if (fns.isArray(tag)) {
    tag.forEach(function (t) {
      return putTag(term, t, reason);
    }); //recursive
    return;
  }
  putTag(term, tag, reason);
  //add 'extra' tag (for some special tags)
  if (tagset[tag] && tagset[tag].also !== undefined) {
    putTag(term, tagset[tag].also, reason);
  }
};

module.exports = wrap;

},{"../../paths":161,"./unTag":160}],160:[function(_dereq_,module,exports){
'use strict';
//set a term as a particular Part-of-speech

var path = _dereq_('../../paths');
var log = path.log;

//remove a tag from a term
var unTag = function unTag(term, tag, reason) {
  var tagset = term.world.tags;
  if (term.tags[tag]) {
    log.unTag(term, tag, reason);
    delete term.tags[tag];

    //delete downstream tags too
    if (tagset[tag]) {
      var also = tagset[tag].downward;
      for (var i = 0; i < also.length; i++) {
        unTag(term, also[i], ' - -   - ');
      }
    }
  }
};

var wrap = function wrap(term, tag, reason) {
  if (!term || !tag) {
    return;
  }
  //support '*' flag - remove all-tags
  if (tag === '*') {
    term.tags = {};
    return;
  }
  //remove this tag
  unTag(term, tag, reason);
  return;
};
module.exports = wrap;

},{"../../paths":161}],161:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  fns: _dereq_('../fns'),
  log: _dereq_('../log')
};

},{"../fns":3,"../log":6}],162:[function(_dereq_,module,exports){
'use strict';
//punctuation regs-  are we having fun yet?

var before = /^([\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]|\x2D+|\.\.+|\/|"|"|\uFF02|'|\u201C|\u2018|\u201F|\u201B|\u201E|\u2E42|\u201A|\xAB|\u2039|\u2035|\u2036|\u2037|\u301D|`|\u301F)+/;
var after = /([\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+|\x2D+|\.\.+|"|"|\uFF02|'|\u201D|\u2019|\u201D|\u2019|\u201D|\u201D|\u2019|\xBB|\u203A|\u2032|\u2033|\u2034|\u301E|\xB4)+$/;
var afterSoft = /([\t-\r \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+|\x2D+|\.\.+|"|"|\uFF02|'|\u201D|\u2019|\u201D|\u2019|\u201D|\u201D|\u2019|\xBB|\u203A|\u2032|\u2033|\u2034|\u301E|\xB4)+[ !,\.;\?]*$/;
var minusNumber = /^( *)-(\$|€|¥|£)?([0-9])/;

//seperate the 'meat' from the trailing/leading whitespace.
//works in concert with ./src/text/tokenize.js
var build_whitespace = function build_whitespace(str) {
  var whitespace = {
    before: '',
    after: ''
  };
  //get before punctuation/whitespace
  //mangle 'far - fetched', but don't mangle '-2'
  var m = str.match(minusNumber);
  if (m !== null) {
    whitespace.before = m[1];
    str = str.replace(/^ */, '');
  } else {
    m = str.match(before);
    if (m !== null) {
      whitespace.before = str.match(before)[0];
      str = str.replace(before, '');
    }
  }
  //get after punctuation/whitespace
  m = str.match(afterSoft);
  if (m !== null) {
    str = str.replace(after, '');
    whitespace.after = m[0];
  }
  return {
    whitespace: whitespace,
    text: str
  };
};
module.exports = build_whitespace;

},{}],163:[function(_dereq_,module,exports){
'use strict';

var Term = _dereq_('../term');
var wordlike = /\S/;
var isBoundary = /^[!?.]+$/;

var notWord = {
  '.': true,
  '-': true, //dash
  '–': true, //en-dash
  '—': true, //em-dash
  '--': true,
  '...': true
};

var hasHyphen = function hasHyphen(str) {
  //dont split 're-do'
  if (/^(re|un)-?[^aeiou]./.test(str) === true) {
    return false;
  }
  //letter-number
  var reg = /^([a-z`"'/]+)(-|–|—)([a-z0-9].*)/i;
  if (reg.test(str) === true) {
    return true;
  }
  //number-letter
  // reg = /^([0-9]+)(-|–|—)([a-z].*)/i;
  // if (reg.test(str) === true) {
  //   return true;
  // }
  //support weird number-emdash combo '2010–2011'
  var reg2 = /^([0-9]+)(–|—)([0-9].*)/i;
  if (reg2.test(str)) {
    return true;
  }
  return false;
};

//support splitting terms like "open/closed"
var hasSlash = function hasSlash(word) {
  var reg = /[a-z]\/[a-z]/;
  if (reg.test(word)) {
    //only one slash though
    if (word.split(/\//g).length === 2) {
      return true;
    }
  }
  return false;
};

//turn a string into an array of terms (naiive for now, lumped later)
var fromString = function fromString(str, world) {
  var result = [];
  var arr = [];
  //start with a naiive split
  str = str || '';
  if (typeof str === 'number') {
    str = String(str);
  }
  var firstSplit = str.split(/(\S+)/);
  for (var i = 0; i < firstSplit.length; i++) {
    var word = firstSplit[i];
    if (hasHyphen(word) === true) {
      //support multiple-hyphenated-terms
      var hyphens = word.split(/[-–—]/);
      for (var o = 0; o < hyphens.length; o++) {
        if (o === hyphens.length - 1) {
          arr.push(hyphens[o]);
        } else {
          arr.push(hyphens[o] + '-');
        }
      }
    } else if (hasSlash(word) === true) {
      var slashes = word.split(/\//);
      arr.push(slashes[0]);
      arr.push('/' + slashes[1]);
    } else {
      arr.push(word);
    }
  }
  //greedy merge whitespace+arr to the right
  var carry = '';
  for (var _i = 0; _i < arr.length; _i++) {
    //if it's more than a whitespace
    if (wordlike.test(arr[_i]) === true && notWord.hasOwnProperty(arr[_i]) === false && isBoundary.test(arr[_i]) === false) {
      result.push(carry + arr[_i]);
      carry = '';
    } else {
      carry += arr[_i];
    }
  }
  //handle last one
  if (carry && result.length > 0) {
    result[result.length - 1] += carry; //put it on the end
  }
  return result.map(function (t) {
    return new Term(t, world);
  });
};
module.exports = fromString;

},{"../term":143}],164:[function(_dereq_,module,exports){
'use strict';

//getters/setters for the Terms class

module.exports = {

  parent: {
    get: function get() {
      return this.refText || this;
    },
    set: function set(r) {
      this.refText = r;
      return this;
    }
  },

  parentTerms: {
    get: function get() {
      return this.refTerms || this;
    },
    set: function set(r) {
      this.refTerms = r;
      return this;
    }
  },

  dirty: {
    get: function get() {
      for (var i = 0; i < this.terms.length; i++) {
        if (this.terms[i].dirty === true) {
          return true;
        }
      }
      return false;
    },
    set: function set(dirt) {
      this.terms.forEach(function (t) {
        t.dirty = dirt;
      });
    }
  },

  refTerms: {
    get: function get() {
      return this._refTerms || this;
    },
    set: function set(ts) {
      this._refTerms = ts;
      return this;
    }
  },
  found: {
    get: function get() {
      return this.terms.length > 0;
    }
  },
  length: {
    get: function get() {
      return this.terms.length;
    }
  },
  isA: {
    get: function get() {
      return 'Terms';
    }
  },
  whitespace: {
    get: function get() {
      var _this = this;

      return {
        before: function before(str) {
          _this.firstTerm().whitespace.before = str;
          return _this;
        },
        after: function after(str) {
          _this.lastTerm().whitespace.after = str;
          return _this;
        }
      };
    }
  }

};

},{}],165:[function(_dereq_,module,exports){
'use strict';

var build = _dereq_('./build');
var getters = _dereq_('./getters');
var w = _dereq_('../world');

//Terms is an array of Term objects, and methods that wrap around them
var Terms = function Terms(arr, world, refText, refTerms) {
  var _this = this;

  this.terms = arr;
  this.world = world || w;
  this.refText = refText;
  this._refTerms = refTerms;
  this.get = function (n) {
    return _this.terms[n];
  };
  //apply getters
  var keys = Object.keys(getters);
  for (var i = 0; i < keys.length; i++) {
    Object.defineProperty(this, keys[i], getters[keys[i]]);
  }
};

Terms.fromString = function (str, world) {
  var termArr = build(str, world);
  var ts = new Terms(termArr, world, null);
  //give each term a original to this ts
  ts.terms.forEach(function (t) {
    t.parentTerms = ts;
  });
  return ts;
};

// Terms = require('./methods/lookup')(Terms);
_dereq_('./match')(Terms);
_dereq_('./methods/tag')(Terms);
_dereq_('./methods/loops')(Terms);
_dereq_('./match/not')(Terms);
_dereq_('./methods/delete')(Terms);
_dereq_('./methods/insert')(Terms);
_dereq_('./methods/misc')(Terms);
_dereq_('./methods/out')(Terms);
_dereq_('./methods/replace')(Terms);
_dereq_('./methods/split')(Terms);
_dereq_('./methods/transform')(Terms);
_dereq_('./methods/lump')(Terms);
module.exports = Terms;

},{"../world":215,"./build":163,"./getters":164,"./match":166,"./match/not":176,"./methods/delete":177,"./methods/insert":178,"./methods/loops":179,"./methods/lump":181,"./methods/misc":182,"./methods/out":183,"./methods/replace":184,"./methods/split":185,"./methods/tag":186,"./methods/transform":187}],166:[function(_dereq_,module,exports){
'use strict';

var syntax = _dereq_('./lib/syntax');
var startHere = _dereq_('./lib/startHere');
var Text = _dereq_('../../text');
var _match = _dereq_('./lib');

var matchMethods = function matchMethods(Terms) {
  var methods = {
    //support regex-like whitelist-match
    match: function match(reg, verbose) {
      var _this = this;

      //fail-fast #1
      if (this.terms.length === 0) {
        return new Text([], this.world, this.parent);
      }
      //fail-fast #2
      if (!reg) {
        return new Text([], this.world, this.parent);
      }
      var matches = _match(this, reg, verbose);
      matches = matches.map(function (a) {
        return new Terms(a, _this.world, _this.refText, _this.refTerms);
      });
      return new Text(matches, this.world, this.parent);
    },

    /**return first match */
    matchOne: function matchOne(str) {
      //fail-fast
      if (this.terms.length === 0) {
        return null;
      }
      var regs = syntax(str);
      for (var t = 0; t < this.terms.length; t++) {
        //don't loop through if '^'
        if (regs[0] && regs[0].starting && t > 0) {
          break;
        }
        var m = startHere(this, t, regs);
        if (m) {
          return m;
        }
      }
      return null;
    },

    /**return first match */
    has: function has(str) {
      return this.matchOne(str) !== null;
    }
  };

  //hook them into result.proto
  Object.keys(methods).forEach(function (k) {
    Terms.prototype[k] = methods[k];
  });
  return Terms;
};

module.exports = matchMethods;

},{"../../text":192,"./lib":170,"./lib/startHere":174,"./lib/syntax":175}],167:[function(_dereq_,module,exports){
'use strict';
//applies the reg capture group setting to the term

var applyCaptureGroup = function applyCaptureGroup(term, reg) {
  if (reg.capture) {
    term.captureGroup = true;
  } else {
    term.captureGroup = undefined;
  }
};
module.exports = applyCaptureGroup;

},{}],168:[function(_dereq_,module,exports){
'use strict';
//take all the matches, and if there is a [capture group], only return that.

var onlyCaptureGroup = function onlyCaptureGroup(matches) {
  var results = [];
  matches.forEach(function (terms) {
    //if there's no capture group, we good.
    if (terms.filter(function (t) {
      return t.captureGroup === true;
    }).length === 0) {
      results.push(terms);
      return;
    }
    //otherwise, just return them as seperate subsets
    var current = [];
    for (var i = 0; i < terms.length; i += 1) {
      if (terms[i].captureGroup) {
        current.push(terms[i]);
      } else if (current.length > 0) {
        results.push(current);
        current = [];
      }
    }
    if (current.length > 0) {
      results.push(current);
    }
  });
  return results;
};
module.exports = onlyCaptureGroup;

},{}],169:[function(_dereq_,module,exports){
'use strict';
//
//find easy reasons to skip running the full match on this

var fastPass = function fastPass(ts, regs) {
  for (var i = 0; i < regs.length; i++) {
    var reg = regs[i];
    var found = false;
    //we can't cheat on these fancy rules:
    if (reg.optional === true || reg.negative === true || reg.minMax !== undefined) {
      continue;
    }
    //look-for missing term-matches
    if (reg.normal !== undefined) {
      for (var o = 0; o < ts.terms.length; o++) {
        if (ts.terms[o].normal === reg.normal || ts.terms[o].silent_term === reg.normal) {
          found = true;
          break;
        }
        //we can't handle lumped-terms with this method
        if (ts.terms[o].lumped === true) {
          return false;
        }
      }
      if (found === false) {
        return true;
      }
    }
    //look for missing tags
    if (reg.tag !== undefined) {
      for (var _o = 0; _o < ts.terms.length; _o++) {
        if (ts.terms[_o].tags[reg.tag] === true) {
          found = true;
          break;
        }
      }
      if (found === false) {
        return true;
      }
    }
  }
  return false;
};
module.exports = fastPass;

},{}],170:[function(_dereq_,module,exports){
'use strict';

var syntax = _dereq_('./syntax');
var startHere = _dereq_('./startHere');
var fastPass = _dereq_('./fastPass');
var handleCaptureGroup = _dereq_('./captureGroup');

//ensure we have atleast one non-optional demand
// const isTautology = function(regs) {
//   for (let i = 0; i < regs.length; i++) {
//     if (!regs[i].optional && !regs[i].astrix && !regs[i].anyOne) {
//       return false;
//     }
//   }
//   return true;
// };

//make a reg syntax from a text object
var findFromTerms = function findFromTerms(ts) {
  if (!ts) {
    return [];
  }
  var arr = ts.terms.map(function (t) {
    return {
      id: t.uid
    };
  });
  return arr;
};
//
var match = function match(ts, reg, verbose) {
  //parse for backwards-compatibility
  if (typeof reg === 'string') {
    reg = syntax(reg);
  } else if (reg && reg.isA === 'Text') {
    reg = findFromTerms(reg.list[0]);
  } else if (reg && reg.isA === 'Terms') {
    reg = findFromTerms(reg);
  }
  if (!reg || reg.length === 0) {
    return [];
  }
  //do a fast-pass for easy negatives
  if (fastPass(ts, reg, verbose) === true) {
    return [];
  }
  //ok, start long-match
  var matches = [];
  for (var t = 0; t < ts.terms.length; t += 1) {
    //don't loop through if '^'
    if (t > 0 && reg[0] && reg[0].starting) {
      break;
    }
    var m = startHere(ts, t, reg, verbose);
    if (m && m.length > 0) {
      matches.push(m);
      //handle capture-groups subset
      // let hasCapture=matches
      //ok, don't try to match these again.
      var skip = m.length - 1;
      t += skip; //this could use some work
    }
  }
  //handle capture-group subset
  matches = handleCaptureGroup(matches);
  return matches;
};
module.exports = match;

},{"./captureGroup":168,"./fastPass":169,"./startHere":174,"./syntax":175}],171:[function(_dereq_,module,exports){
'use strict';

var applyCaptureGroup = _dereq_('./applyCaptureGroup');

//compare 1 term to one reg
var perfectMatch = function perfectMatch(term, reg) {
  if (!term || !reg) {
    return false;
  }
  //support '.' - any
  if (reg.anyOne === true) {
    return true;
  }
  //pos-match
  if (reg.tag !== undefined) {
    return term.tags[reg.tag];
  }
  //id-match
  if (reg.id !== undefined) {
    return reg.id === term.uid;
  }
  //text-match
  if (reg.normal !== undefined) {
    return reg.normal === term.normal || reg.normal === term.silent_term;
  }
  //suffix matches '-nny'
  if (reg.suffix === true && reg.partial !== undefined) {
    var len = term.normal.length;
    return term.normal.substr(len - reg.partial.length, len) === reg.partial;
  }
  //prefix matches 'fun-'
  if (reg.prefix === true && reg.partial !== undefined) {
    return term.normal.substr(0, reg.partial.length) === reg.partial;
  }
  //infix matches '-nn-'
  if (reg.infix === true && reg.partial) {
    return term.normal.indexOf(reg.partial) !== -1;
  }
  //full-on regex-match '/a*?/'
  if (reg.regex !== undefined) {
    return reg.regex.test(term.normal) || reg.regex.test(term.text);
  }
  //one-of term-match
  if (reg.oneOf !== undefined) {
    for (var i = 0; i < reg.oneOf.tagArr.length; i++) {
      if (term.tags.hasOwnProperty(reg.oneOf.tagArr[i]) === true) {
        return true;
      }
    }
    return reg.oneOf.terms.hasOwnProperty(term.normal) || reg.oneOf.terms.hasOwnProperty(term.silent_term);
  }
  return false;
};

//wrap above method, to support '!' negation
var isMatch = function isMatch(term, reg, verbose) {
  if (!term || !reg) {
    return false;
  }
  var found = perfectMatch(term, reg, verbose);
  //reverse it for .not()
  if (reg.negative) {
    found = !Boolean(found);
  }
  if (found) {
    //only apply capture group settings to matches
    applyCaptureGroup(term, reg);
  }
  return found;
};
module.exports = isMatch;

},{"./applyCaptureGroup":167}],172:[function(_dereq_,module,exports){
'use strict';

var almostMatch = function almostMatch(reg_str, term) {
  var want = term.normal.substr(0, reg_str.length);
  return want === reg_str;
};

// match ['john', 'smith'] regs, when the term is lumped
var lumpMatch = function lumpMatch(term, regs, reg_i) {
  var reg_str = regs[reg_i].normal;
  //is this a partial match? 'tony'& 'tony hawk'
  if (reg_str !== undefined && almostMatch(reg_str, term)) {
    //try to grow it
    reg_i = reg_i + 1;
    for (reg_i; reg_i < regs.length; reg_i++) {
      reg_str += ' ' + regs[reg_i].normal;
      // is it now perfect?
      if (reg_str === term.normal) {
        return reg_i;
      }
      // is it still almost?
      if (almostMatch(reg_str, term) === false) {
        return null;
      }
    }
  }
  return null;
};

module.exports = lumpMatch;

},{}],173:[function(_dereq_,module,exports){
arguments[4][73][0].apply(exports,arguments)
},{"../../paths":189,"dup":73}],174:[function(_dereq_,module,exports){
'use strict';

var lumpMatch = _dereq_('./lumpMatch');
var isMatch = _dereq_('./isMatch');
var applyCaptureGroup = _dereq_('./applyCaptureGroup');

// match everything until this point - '*'
var greedyUntil = function greedyUntil(ts, i, reg) {
  for (; i < ts.length; i++) {
    if (isMatch(ts.terms[i], reg)) {
      return i;
    }
  }
  return null;
};

//keep matching this reg as long as possible
var greedyOf = function greedyOf(ts, i, reg, until) {
  for (; i < ts.length; i++) {
    var t = ts.terms[i];
    //found next reg ('until')
    if (until && isMatch(t, until)) {
      return i;
    }
    //stop here
    if (!isMatch(t, reg)) {
      return i;
    }
  }
  return i;
};

//try and match all regs, starting at this term
var startHere = function startHere(ts, startAt, regs, verbose) {
  var term_i = startAt;
  //check each regex-thing
  for (var reg_i = 0; reg_i < regs.length; reg_i++) {
    var term = ts.terms[term_i];
    var reg = regs[reg_i];
    var next_reg = regs[reg_i + 1];

    if (!term) {
      //we didn't need it anyways
      if (reg.optional === true) {
        continue;
      }
      return null;
    }

    //catch '^' errors
    if (reg.starting === true && term_i > 0) {
      return null;
    }

    //catch '$' errors
    if (reg.ending === true && term_i !== ts.length - 1 && !reg.minMax) {
      return null;
    }

    //support '*'
    if (reg.astrix === true) {
      //just grab until the end..
      if (!next_reg) {
        var terms = ts.terms.slice(startAt, ts.length);
        //apply capture group settings for all wildcard terms
        for (var wildcardTerm_i = term_i - startAt; wildcardTerm_i < terms.length; wildcardTerm_i++) {
          applyCaptureGroup(terms[wildcardTerm_i], reg);
        }
        return terms;
      }
      var foundAt = greedyUntil(ts, term_i, regs[reg_i + 1]);
      if (!foundAt) {
        return null;
      }
      //apply capture group settings for all wildcard terms
      for (var _wildcardTerm_i = term_i; _wildcardTerm_i < foundAt; _wildcardTerm_i++) {
        applyCaptureGroup(ts.terms[_wildcardTerm_i], reg);
      }
      term_i = foundAt + 1;
      reg_i += 1;
      continue;
    }

    //support '#Noun{x,y}'
    if (regs[reg_i].minMax !== undefined) {
      var min = regs[reg_i].minMax.min || 0;
      var max = regs[reg_i].minMax.max;
      var until = regs[reg_i + 1];
      for (var i = 0; i < max; i++) {
        //ergh, please clean this loop up..
        var t = ts.terms[term_i + i];
        if (!t) {
          return null;
        }
        //end here
        if (isMatch(t, reg) === false) {
          return null;
        }
        //should we be greedier?
        if (i < min - 1) {
          continue; //gotta keep going!
        }
        //we can end here, after the minimum
        if (!until) {
          term_i += 1;
          break;
        }
        // we're greedy-to-now
        if (i >= min && isMatch(t, until)) {
          break;
        }
        //end with a greedy-match for next term
        var nextT = ts.terms[term_i + i + 1];
        if (nextT && isMatch(nextT, until)) {
          term_i += i + 2;
          reg_i += 1;
          break;
        } else if (i === max - 1) {
          //we've maxed-out
          return null;
        }
      }
      continue;
    }

    //if optional, check next one
    if (reg.optional === true) {
      var _until = regs[reg_i + 1];
      term_i = greedyOf(ts, term_i, reg, _until);
      continue;
    }

    //check a perfect match
    if (isMatch(term, reg, verbose)) {
      term_i += 1;
      //try to greedy-match '+'
      if (reg.consecutive === true) {
        var _until2 = regs[reg_i + 1];
        term_i = greedyOf(ts, term_i, reg, _until2);
      }
      continue;
    }

    if (term.silent_term && !term.normal) {
      //skip over silent contraction terms
      //we will continue on it, but not start on it
      if (reg_i === 0) {
        return null;
      }
      //try the next term, but with this regex again
      term_i += 1;
      reg_i -= 1;
      continue;
    }

    //handle partial-matches of lumped terms
    var lumpUntil = lumpMatch(term, regs, reg_i, verbose);
    if (lumpUntil !== null) {
      reg_i = lumpUntil;
      term_i += 1;
      continue;
    }

    //was it optional anways?
    if (reg.optional === true) {
      continue;
    }
    return null;
  }
  return ts.terms.slice(startAt, term_i);
};

module.exports = startHere;

},{"./applyCaptureGroup":167,"./isMatch":171,"./lumpMatch":172}],175:[function(_dereq_,module,exports){
'use strict';
// parse a search lookup term find the regex-like syntax in this term

var fns = _dereq_('./paths').fns;
//regs-
var range = /\{[0-9,]+\}$/;

//trim char#0
var noFirst = function noFirst(str) {
  return str.substr(1, str.length);
};
var noLast = function noLast(str) {
  return str.substring(0, str.length - 1);
};

//turn 'regex-like' search string into parsed json
var parse_term = function parse_term(term) {
  term = term || '';
  term = term.trim();

  var reg = {};
  //order matters here

  //1-character hasta be a text-match
  if (term.length === 1 && term !== '.' && term !== '*') {
    reg.normal = term.toLowerCase();
    return reg;
  }
  //negation ! flag
  if (term.charAt(0) === '!') {
    term = noFirst(term);
    reg.negative = true;
  }
  //leading ^ flag
  if (term.charAt(0) === '^') {
    term = noFirst(term);
    reg.starting = true;
  }
  //trailing $ flag means ending
  if (term.charAt(term.length - 1) === '$') {
    term = noLast(term);
    reg.ending = true;
  }
  //optional flag
  if (term.charAt(term.length - 1) === '?') {
    term = noLast(term);
    reg.optional = true;
  }
  //atleast-one-but-greedy flag
  if (term.charAt(term.length - 1) === '+') {
    term = noLast(term);
    reg.consecutive = true;
  }
  //prefix/suffix/infix matches
  if (term.charAt(term.length - 1) === '_') {
    term = noLast(term);
    reg.prefix = true;
    //try both '-match-'
    if (term.charAt(0) === '_') {
      term = noFirst(term);
      reg.prefix = undefined;
      reg.infix = true;
    }
    reg.partial = term;
    term = '';
  } else if (term.charAt(0) === '_') {
    term = noFirst(term);
    reg.suffix = true;
    reg.partial = term;
    term = '';
  }
  //min/max any '{1,3}'
  if (term.charAt(term.length - 1) === '}' && range.test(term) === true) {
    var m = term.match(/\{([0-9])*,? ?([0-9]+)\}/);
    reg.minMax = {
      min: parseInt(m[1], 10) || 0,
      max: parseInt(m[2], 10)
    };
    term = term.replace(range, '');
  }
  //pos flag
  if (term.charAt(0) === '#') {
    term = noFirst(term);
    reg.tag = fns.titleCase(term);
    term = '';
  }
  //support /regex/ mode
  if (term.charAt(0) === '/' && term.charAt(term.length - 1) === '/') {
    term = noLast(term);
    term = noFirst(term);
    //actually make the regex
    reg.regex = new RegExp(term, 'i');
    term = '';
  }
  //one_of options flag
  if (term.charAt(0) === '(' && term.charAt(term.length - 1) === ')') {
    term = noLast(term);
    term = noFirst(term);
    var arr = term.split(/\|/g);
    reg.oneOf = {
      terms: {},
      tagArr: []
    };
    arr.forEach(function (str) {
      //try a tag match
      if (str.charAt(0) === '#') {
        var tag = str.substr(1, str.length);
        tag = fns.titleCase(tag);
        reg.oneOf.tagArr.push(tag);
      } else {
        reg.oneOf.terms[str] = true;
      }
    });
    term = '';
  }
  //a period means any one term
  if (term === '.') {
    reg.anyOne = true;
    term = '';
  }
  //a * means anything until sentence end
  if (term === '*') {
    reg.astrix = true;
    term = '';
  }
  if (term !== '') {
    //support \ encoding of #[]()*+?^
    term = term.replace(/\\([\\#\*\.\[\]\(\)\+\?\^])/g, '');
    reg.normal = term.toLowerCase();
  }
  return reg;
};

//turn a match string into an array of objects
var parse_all = function parse_all(input) {
  input = input || '';
  var regs = input.split(/ +/);
  //bundle-up multiple-words inside parentheses
  for (var i = 0; i < regs.length; i += 1) {
    if (regs[i].indexOf('(') !== -1 && regs[i].indexOf(')') === -1) {
      var nextWord = regs[i + 1];
      if (nextWord && nextWord.indexOf('(') === -1 && nextWord.indexOf(')') !== -1) {
        regs[i + 1] = regs[i] + ' ' + regs[i + 1];
        regs[i] = '';
      }
    }
  }
  regs = regs.filter(function (f) {
    return f;
  });
  var captureOn = false;
  regs = regs.map(function (reg) {
    var hasEnd = false;
    //support [#Noun] capture-group syntax
    if (reg.charAt(0) === '[') {
      reg = noFirst(reg);
      captureOn = true;
    }
    if (reg.charAt(reg.length - 1) === ']') {
      reg = noLast(reg);
      captureOn = false;
      hasEnd = true;
    }
    reg = parse_term(reg);
    if (captureOn === true || hasEnd === true) {
      reg.capture = true;
    }
    return reg;
  });
  return regs;
};

module.exports = parse_all;
// console.log(JSON.stringify(parse_all('the (canadian|united states|british) senate'), null, 2));

},{"./paths":173}],176:[function(_dereq_,module,exports){
'use strict';
//

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var syntax = _dereq_('./lib/syntax');
var startHere = _dereq_('./lib/startHere');
var Text = _dereq_('../../text');

var addfns = function addfns(Terms) {
  var fns = {
    //blacklist from a {word:true} object
    notObj: function notObj(r, obj) {
      var matches = [];
      var current = [];
      r.terms.forEach(function (t) {
        //TODO? support multi-word blacklists
        //we should blacklist this term
        if (obj.hasOwnProperty(t.normal)) {
          if (current.length) {
            matches.push(current);
          }
          current = [];
        } else {
          current.push(t);
        }
      });
      //add remainder
      if (current.length) {
        matches.push(current);
      }
      matches = matches.map(function (a) {
        return new Terms(a, r.world, r.refText, r.refTerms);
      });
      return new Text(matches, r.world, r.parent);
    },

    //blacklist from a match string
    notString: function notString(r, want, verbose) {
      var matches = [];
      var regs = syntax(want);
      var terms = [];
      //try the match starting from each term
      for (var i = 0; i < r.terms.length; i++) {
        var bad = startHere(r, i, regs, verbose);
        if (bad && bad.length > 0) {
          //reset matches
          if (terms.length > 0) {
            matches.push(terms);
            terms = [];
          }
          //skip these terms now
          i += bad.length - 1;
          continue;
        }
        terms.push(r.terms[i]);
      }
      //remaining ones
      if (terms.length > 0) {
        matches.push(terms);
      }
      matches = matches.map(function (a) {
        return new Terms(a, r.world, r.refText, r.refTerms);
      });
      // return matches
      return new Text(matches, r.world, r.parent);
    }
  };
  //blacklist from a [word, word] array
  fns.notArray = function (r, arr) {
    var obj = arr.reduce(function (h, a) {
      h[a] = true;
      return h;
    }, {});
    return fns.notObj(r, obj);
  };
  fns.notText = function (r, m) {
    var arr = m.out('array'); //i guess this is fine..
    return fns.notArray(r, arr);
  };

  /**return everything but these matches*/
  Terms.prototype.not = function (want, verbose) {
    //support [word, word] blacklist
    if ((typeof want === 'undefined' ? 'undefined' : _typeof(want)) === 'object') {
      var type = Object.prototype.toString.call(want);
      if (type === '[object Array]') {
        return fns.notArray(this, want, verbose);
      }
      if (type === '[object Object]') {
        if (want.isA === 'Text') {
          return fns.notText(this, want, verbose);
        } else {
          return fns.notObj(this, want, verbose);
        }
      }
    }
    if (typeof want === 'string') {
      return fns.notString(this, want, verbose);
    }
    return this;
  };
  return Terms;
};

module.exports = addfns;

},{"../../text":192,"./lib/startHere":174,"./lib/syntax":175}],177:[function(_dereq_,module,exports){
'use strict';

var mutate = _dereq_('../mutate');

var addMethod = function addMethod(Terms) {

  //hook it into Terms.proto
  Terms.prototype.delete = function (reg) {
    //don't touch parent if empty
    if (!this.found) {
      return this;
    }
    //remove all selected
    if (!reg) {
      this.parentTerms = mutate.deleteThese(this.parentTerms, this);
      return this;
    }
    //only remove a portion of this
    var found = this.match(reg);
    if (found.found) {
      var r = mutate.deleteThese(this, found);
      return r;
    }
    return this.parentTerms;
  };

  return Terms;
};

module.exports = addMethod;

},{"../mutate":188}],178:[function(_dereq_,module,exports){
'use strict';

var mutate = _dereq_('../mutate');

//whitespace
var addSpaceAt = function addSpaceAt(ts, i) {
  if (!ts.terms.length || !ts.terms[i]) {
    return ts;
  }
  ts.terms[i].whitespace.before = ' ';
  return ts;
};

var insertMethods = function insertMethods(Terms) {

  //accept any sorta thing
  var ensureTerms = function ensureTerms(input, world) {
    if (input.isA === 'Terms') {
      return input;
    }
    if (input.isA === 'Term') {
      return new Terms([input], world);
    }
    //handle a string
    var ts = Terms.fromString(input, world);
    ts.tagger();
    return ts;
  };

  var methods = {

    insertBefore: function insertBefore(input, tag) {
      var original_l = this.terms.length;
      var ts = ensureTerms(input, this.world);
      if (tag) {
        ts.tag(tag);
      }
      var index = this.index();
      //pad a space on parent
      addSpaceAt(this.parentTerms, index);
      if (index > 0) {
        addSpaceAt(ts, 0); //if in middle of sentence
      }
      this.parentTerms.terms = mutate.insertAt(this.parentTerms.terms, index, ts);
      //also copy them to current selection
      if (this.terms.length === original_l) {
        this.terms = ts.terms.concat(this.terms);
      }
      return this;
    },

    insertAfter: function insertAfter(input, tag) {
      var original_l = this.terms.length;
      var ts = ensureTerms(input, this.world);
      if (tag) {
        ts.tag(tag);
      }
      var index = this.terms[this.terms.length - 1].index();
      //beginning whitespace to ts
      addSpaceAt(ts, 0);
      this.parentTerms.terms = mutate.insertAt(this.parentTerms.terms, index + 1, ts);
      //also copy them to current selection
      if (this.terms.length === original_l) {
        this.terms = this.terms.concat(ts.terms);
      }
      return this;
    },

    insertAt: function insertAt(index, input, tag) {
      if (index < 0) {
        index = 0;
      }
      var original_l = this.terms.length;
      var ts = ensureTerms(input, this.world);
      //tag that thing too
      if (tag) {
        ts.tag(tag);
      }
      if (index > 0) {
        addSpaceAt(ts, 0); //if in middle of sentence
      }
      this.parentTerms.terms = mutate.insertAt(this.parentTerms.terms, index, ts);
      //also copy them to current selection
      if (this.terms.length === original_l) {
        //splice the new terms into this (yikes!)
        Array.prototype.splice.apply(this.terms, [index, 0].concat(ts.terms));
      }
      //beginning whitespace to ts
      if (index === 0) {
        this.terms[0].whitespace.before = '';
        ts.terms[ts.terms.length - 1].whitespace.after = ' ';
      }
      return this;
    }

  };

  //hook them into result.proto
  Object.keys(methods).forEach(function (k) {
    Terms.prototype[k] = methods[k];
  });
  return Terms;
};

module.exports = insertMethods;

},{"../mutate":188}],179:[function(_dereq_,module,exports){
'use strict';
//these methods are simply term-methods called in a loop

var addMethods = function addMethods(Terms) {

  var foreach = [
  // ['tag'],
  // ['unTag'],
  // ['canBe'],
  ['toUpperCase', 'UpperCase'], ['toLowerCase'], ['toTitleCase', 'TitleCase']];

  foreach.forEach(function (arr) {
    var k = arr[0];
    var tag = arr[1];
    var myFn = function myFn() {
      var args = arguments;
      this.terms.forEach(function (t) {
        t[k].apply(t, args);
      });
      if (tag) {
        this.tag(tag, k);
      }
      return this;
    };
    Terms.prototype[k] = myFn;
  });
  return Terms;
};

module.exports = addMethods;

},{}],180:[function(_dereq_,module,exports){
'use strict';

var Term = _dereq_('../../../term');
//merge two term objects.. carefully

var makeText = function makeText(a, b) {
  var text = a.whitespace.before + a.text + a.whitespace.after;
  text += b.whitespace.before + b.text + b.whitespace.after;
  return text;
};

var combine = function combine(s, i) {
  var a = s.terms[i];
  var b = s.terms[i + 1];
  if (!b) {
    return;
  }
  var text = makeText(a, b);
  s.terms[i] = new Term(text, a.context);
  s.terms[i].normal = a.normal + ' ' + b.normal;
  s.terms[i].lumped = true;
  s.terms[i].parentTerms = s.terms[i + 1].parentTerms;
  s.terms[i + 1] = null;
  s.terms = s.terms.filter(function (t) {
    return t !== null;
  });
  return;
};

module.exports = combine;

},{"../../../term":143}],181:[function(_dereq_,module,exports){
'use strict';

var combine = _dereq_('./combine');
var mutate = _dereq_('../../mutate');

//merge-together our current match into one term
var combineThem = function combineThem(ts, tags) {
  var len = ts.terms.length;
  for (var i = 0; i < len; i++) {
    combine(ts, 0);
  }
  var lumped = ts.terms[0];
  lumped.tags = tags;
  return lumped;
};

var lumpMethods = function lumpMethods(Terms) {

  Terms.prototype.lump = function () {
    //collect the tags up
    var index = this.index();
    var tags = {};
    this.terms.forEach(function (t) {
      Object.keys(t.tags).forEach(function (tag) {
        return tags[tag] = true;
      });
    });
    //just lump the whole-thing together
    if (this.parentTerms === this) {
      var _lumped = combineThem(this, tags);
      this.terms = [_lumped];
      return this;
    }
    //otherwise lump just part of it. delete/insert.
    this.parentTerms = mutate.deleteThese(this.parentTerms, this);
    //merge-together our current match into one term
    var lumped = combineThem(this, tags);
    //put it back (in the same place)
    this.parentTerms.terms = mutate.insertAt(this.parentTerms.terms, index, lumped);
    return this;
  };

  return Terms;
};

module.exports = lumpMethods;

},{"../../mutate":188,"./combine":180}],182:[function(_dereq_,module,exports){
'use strict';

var _tagger = _dereq_('../../tagger');

var miscMethods = function miscMethods(Terms) {
  var methods = {
    tagger: function tagger() {
      _tagger(this);
      return this;
    },
    firstTerm: function firstTerm() {
      return this.terms[0];
    },
    lastTerm: function lastTerm() {
      return this.terms[this.terms.length - 1];
    },
    all: function all() {
      return this.parent;
    },
    data: function data() {
      return {
        text: this.out('text'),
        normal: this.out('normal')
      };
    },
    term: function term(n) {
      return this.terms[n];
    },
    first: function first() {
      var t = this.terms[0];
      return new Terms([t], this.world, this.refText, this.refTerms);
    },
    last: function last() {
      var t = this.terms[this.terms.length - 1];
      return new Terms([t], this.world, this.refText, this.refTerms);
    },
    slice: function slice(start, end) {
      var terms = this.terms.slice(start, end);
      return new Terms(terms, this.world, this.refText, this.refTerms);
    },
    index: function index() {
      var parent = this.parentTerms;
      var first = this.terms[0];
      if (!parent || !first) {
        return null; //maybe..
      }
      for (var i = 0; i < parent.terms.length; i++) {
        if (first === parent.terms[i]) {
          return i;
        }
      }
      return null;
    },
    termIndex: function termIndex() {
      var first = this.terms[0];
      var ref = this.refText || this;
      if (!ref || !first) {
        return null; //maybe..
      }
      var n = 0;
      for (var i = 0; i < ref.list.length; i++) {
        var ts = ref.list[i];
        for (var o = 0; o < ts.terms.length; o++) {
          if (ts.terms[o] === first) {
            return n;
          }
          n += 1;
        }
      }
      return n;
    },
    //number of characters in this match
    chars: function chars() {
      return this.terms.reduce(function (i, t) {
        i += t.whitespace.before.length;
        i += t.text.length;
        i += t.whitespace.after.length;
        return i;
      }, 0);
    },
    //just .length
    wordCount: function wordCount() {
      return this.terms.length;
    },
    /** punctuation */
    setPunctuation: function setPunctuation(punct) {
      var last = this.terms[this.terms.length - 1];
      last.setPunctuation(punct);
    },
    getPunctuation: function getPunctuation() {
      var lastTerm = this.last().terms[0];
      if (!lastTerm) {
        return '';
      }
      return lastTerm.getPunctuation() || '';
    },
    //this has term-order logic, so has to be here
    toCamelCase: function toCamelCase() {
      this.toTitleCase();
      this.terms.forEach(function (t, i) {
        if (i !== 0) {
          t.whitespace.before = '';
        }
        t.whitespace.after = '';
      });
      this.tag('#CamelCase', 'toCamelCase');
      return this;
    }
  };

  //hook them into result.proto
  Object.keys(methods).forEach(function (k) {
    Terms.prototype[k] = methods[k];
  });
  return Terms;
};

module.exports = miscMethods;

},{"../../tagger":95}],183:[function(_dereq_,module,exports){
'use strict';

var fns = _dereq_('../paths').fns;

var methods = {
  text: function text(ts) {
    return ts.terms.reduce(function (str, t) {
      str += t.out('text');
      return str;
    }, '');
  },
  //like 'text', but no leading/trailing whitespace
  match: function match(ts) {
    var str = '';
    var len = ts.terms.length;
    for (var i = 0; i < len; i++) {
      if (i > 0) {
        str += ts.terms[i].whitespace.before;
      }
      str += ts.terms[i].text.replace(/[,.?!]$/, ''); //remove comma
      if (i < len - 1) {
        str += ts.terms[i].whitespace.after;
      }
    }
    return str;
  },

  normal: function normal(ts) {
    var terms = ts.terms.filter(function (t) {
      return t.text;
    });
    terms = terms.map(function (t) {
      return t.normal; //+ punct;
    });
    return terms.join(' ');
  },

  grid: function grid(ts) {
    var str = '  ';
    str += ts.terms.reduce(function (s, t) {
      s += fns.leftPad(t.text, 11);
      return s;
    }, '');
    return str + '\n\n';
  },

  color: function color(ts) {
    return ts.terms.reduce(function (s, t) {
      s += fns.printTerm(t);
      return s;
    }, '');
  },
  csv: function csv(ts) {
    return ts.terms.map(function (t) {
      return t.normal.replace(/,/g, '');
    }).join(',');
  },

  newlines: function newlines(ts) {
    return ts.terms.reduce(function (str, t) {
      str += t.out('text').replace(/\n/g, ' ');
      return str;
    }, '').replace(/^\s/, '');
  },
  /** no punctuation, fancy business **/
  root: function root(ts) {
    return ts.terms.map(function (t) {
      return t.silent_term || t.root;
    }).join(' ').toLowerCase();
  },

  html: function html(ts) {
    return ts.terms.map(function (t) {
      return t.render.html();
    }).join(' ');
  },
  debug: function debug(ts) {
    ts.terms.forEach(function (t) {
      t.out('debug');
    });
  },
  custom: function custom(ts, obj) {
    return ts.terms.map(function (t) {
      return Object.keys(obj).reduce(function (h, k) {
        if (obj[k] && t[k]) {
          if (typeof t[k] === 'function') {
            h[k] = t[k]();
          } else {
            h[k] = t[k];
          }
        }
        return h;
      }, {});
    });
  }
};
methods.plaintext = methods.text;
methods.normalize = methods.normal;
methods.normalized = methods.normal;
methods.colors = methods.color;
methods.tags = methods.terms;

var renderMethods = function renderMethods(Terms) {
  Terms.prototype.out = function (fn) {
    if (typeof fn === 'string') {
      if (methods[fn]) {
        return methods[fn](this);
      }
    } else if (fns.isObject(fn) === true) {
      //support .out({})
      return methods.custom(this, fn);
    }
    return methods.text(this);
  };
  //check method
  Terms.prototype.debug = function () {
    return methods.debug(this);
  };
  return Terms;
};

module.exports = renderMethods;

},{"../paths":189}],184:[function(_dereq_,module,exports){
'use strict';

var mutate = _dereq_('../mutate');

var replaceMethods = function replaceMethods(Terms) {
  var methods = {
    /**swap this for that */
    replace: function replace(str1, str2, keepTags) {
      //in this form, we 'replaceWith'
      if (str2 === undefined) {
        return this.replaceWith(str1, keepTags);
      }
      this.match(str1).replaceWith(str2, keepTags);
      return this;
    },

    /**swap this for that */
    replaceWith: function replaceWith(str, keepTags) {
      var newTs = Terms.fromString(str, this.world);
      newTs.tagger();
      //if instructed, apply old tags to new terms
      if (keepTags) {
        this.terms.forEach(function (t, i) {
          var tags = Object.keys(t.tags);
          if (newTs.terms[i] !== undefined) {
            tags.forEach(function (tg) {
              return newTs.terms[i].tag(tg, 'from-memory');
            });
          }
        });
      }
      //keep its ending punctation..
      var endPunct = this.getPunctuation();
      //grab the insertion place..
      var index = this.index();
      this.parentTerms = mutate.deleteThese(this.parentTerms, this);
      this.parentTerms.terms = mutate.insertAt(this.parentTerms.terms, index, newTs);
      this.terms = newTs.terms;
      //add-in the punctuation at the end..
      if (this.terms.length > 0) {
        this.terms[this.terms.length - 1].whitespace.after += endPunct;
      }
      return this;
    }
  };

  //hook them into result.proto
  Object.keys(methods).forEach(function (k) {
    Terms.prototype[k] = methods[k];
  });
  return Terms;
};

module.exports = replaceMethods;

},{"../mutate":188}],185:[function(_dereq_,module,exports){
'use strict';

//break apart a termlist into (before, match after)

var breakUpHere = function breakUpHere(terms, ts) {
  var firstTerm = ts.terms[0];
  var len = ts.terms.length;
  for (var i = 0; i < terms.length; i++) {
    if (terms[i] === firstTerm) {
      return {
        before: terms.slice(0, i),
        match: terms.slice(i, i + len),
        after: terms.slice(i + len, terms.length)
      };
    }
  }
  return {
    after: terms
  };
};

var splitMethods = function splitMethods(Terms) {
  var methods = {
    /** at the end of the match, split the terms **/
    splitAfter: function splitAfter(reg, verbose) {
      var _this = this;

      var ms = this.match(reg, verbose); //Array[ts]
      var termArr = this.terms;
      var all = [];
      ms.list.forEach(function (lookFor) {
        var section = breakUpHere(termArr, lookFor);
        if (section.before && section.match) {
          all.push(section.before.concat(section.match));
        }
        termArr = section.after;
      });
      //add the remaining
      if (termArr.length) {
        all.push(termArr);
      }
      //make them termlists
      all = all.map(function (ts) {
        var parent = _this.refText; //|| this;
        return new Terms(ts, _this.world, parent, _this.refTerms);
      });
      return all;
    },

    /** return only before & after  the match**/
    splitOn: function splitOn(reg, verbose) {
      var _this2 = this;

      var ms = this.match(reg, verbose); //Array[ts]
      var termArr = this.terms;
      var all = [];
      ms.list.forEach(function (lookFor) {
        var section = breakUpHere(termArr, lookFor);
        if (section.before) {
          all.push(section.before);
        }
        if (section.match) {
          all.push(section.match);
        }
        termArr = section.after;
      });
      //add the remaining
      if (termArr.length) {
        all.push(termArr);
      }
      //make them termlists
      all = all.filter(function (a) {
        return a && a.length;
      });
      all = all.map(function (ts) {
        return new Terms(ts, ts.world, ts.refText, _this2.refTerms);
      });
      return all;
    },

    /** at the start of the match, split the terms**/
    splitBefore: function splitBefore(reg, verbose) {
      var _this3 = this;

      var ms = this.match(reg, verbose); //Array[ts]
      var termArr = this.terms;
      var all = [];
      ms.list.forEach(function (lookFor) {
        var section = breakUpHere(termArr, lookFor);
        if (section.before) {
          all.push(section.before);
        }
        if (section.match) {
          all.push(section.match);
        }
        termArr = section.after;
      });
      //add the remaining
      if (termArr.length) {
        all.push(termArr);
      }
      //cleanup-step: merge all (middle) matches with the next one
      for (var i = 0; i < all.length; i++) {
        for (var o = 0; o < ms.length; o++) {
          if (ms.list[o].terms[0] === all[i][0]) {
            if (all[i + 1]) {
              all[i] = all[i].concat(all[i + 1]);
              all[i + 1] = [];
            }
          }
        }
      }
      //make them termlists
      all = all.filter(function (a) {
        return a && a.length;
      });
      all = all.map(function (ts) {
        return new Terms(ts, ts.world, ts.refText, _this3.refTerms);
      });
      return all;
    }
  };

  //hook them into result.proto
  Object.keys(methods).forEach(function (k) {
    Terms.prototype[k] = methods[k];
  });
  return Terms;
};

module.exports = splitMethods;
exports = splitMethods;

},{}],186:[function(_dereq_,module,exports){
'use strict';

var addMethod = function addMethod(Terms) {
  var methods = {
    tag: function tag(_tag, reason) {
      var tags = [];
      if (typeof _tag === 'string') {
        tags = _tag.split(' ');
      }
      //fancy version:
      if (tags.length > 1) {
        //do indepenent tags for each term:
        this.terms.forEach(function (t, i) {
          t.tag(tags[i], reason);
        });
        return this;
      }
      //non-fancy version:
      this.terms.forEach(function (t) {
        t.tag(_tag, reason);
      });
      return this;
    },

    unTag: function unTag(tag, reason) {
      var tags = [];
      if (typeof tag === 'string') {
        tags = tag.split(' ');
      }
      //fancy version:
      if (tags.length > 1) {
        //do indepenent tags for each term:
        this.terms.forEach(function (t, i) {
          t.unTag(tags[i], reason);
        });
        return this;
      }
      //non-fancy version:
      this.terms.forEach(function (t) {
        t.unTag(tag, reason);
      });
      return this;
    },

    //which terms are consistent with this tag
    canBe: function canBe(tag) {
      var terms = this.terms.filter(function (t) {
        return t.canBe(tag);
      });
      return new Terms(terms, this.world, this.refText, this.refTerms);
    }
  };
  //hook them into result.proto
  Object.keys(methods).forEach(function (k) {
    Terms.prototype[k] = methods[k];
  });
  return Terms;
};

module.exports = addMethod;

},{}],187:[function(_dereq_,module,exports){
'use strict';

var transforms = function transforms(Terms) {
  var methods = {
    clone: function clone() {
      // this.world = this.world.clone();
      var terms = this.terms.map(function (t) {
        return t.clone();
      });
      return new Terms(terms, this.world, this.refText, null); //, this.refTerms
    },
    hyphenate: function hyphenate() {
      var _this = this;

      this.terms.forEach(function (t, i) {
        if (i !== _this.terms.length - 1) {
          t.whitespace.after = '-';
        }
        if (i !== 0) {
          t.whitespace.before = '';
        }
      });
      return this;
    },
    dehyphenate: function dehyphenate() {
      this.terms.forEach(function (t) {
        if (t.whitespace.after === '-') {
          t.whitespace.after = ' ';
        }
      });
      return this;
    },
    trim: function trim() {
      if (this.length <= 0) {
        return this;
      }
      this.terms[0].whitespace.before = '';
      this.terms[this.terms.length - 1].whitespace.after = '';
      return this;
    }
  };

  //hook them into result.proto
  Object.keys(methods).forEach(function (k) {
    Terms.prototype[k] = methods[k];
  });
  return Terms;
};

module.exports = transforms;

},{}],188:[function(_dereq_,module,exports){
'use strict';
//

var getTerms = function getTerms(needle) {
  var arr = [];
  if (needle.isA === 'Terms') {
    arr = needle.terms;
  } else if (needle.isA === 'Text') {
    arr = needle.flatten().list[0].terms;
  } else if (needle.isA === 'Term') {
    arr = [needle];
  }
  return arr;
};

//remove them
exports.deleteThese = function (source, needle) {
  var arr = getTerms(needle);
  source.terms = source.terms.filter(function (t) {
    for (var i = 0; i < arr.length; i++) {
      if (t === arr[i]) {
        return false;
      }
    }
    return true;
  });
  return source;
};

//add them
exports.insertAt = function (terms, i, needle) {
  needle.dirty = true;
  var arr = getTerms(needle);
  //handle whitespace
  if (i > 0 && arr[0] && !arr[0].whitespace.before) {
    arr[0].whitespace.before = ' ';
  }
  //gnarly splice
  //-( basically  - terms.splice(i+1, 0, arr) )
  Array.prototype.splice.apply(terms, [i, 0].concat(arr));
  return terms;
};

},{}],189:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  fns: _dereq_('../fns'),
  Term: _dereq_('../term')
};

},{"../fns":3,"../term":143}],190:[function(_dereq_,module,exports){
'use strict';

var Text = _dereq_('./index');
var tokenize = _dereq_('./tokenize');
var paths = _dereq_('./paths');
var Terms = paths.Terms;
var fns = paths.fns;

var fromString = function fromString(str, world) {
  var sentences = [];
  //allow pre-tokenized input
  if (fns.isArray(str)) {
    sentences = str;
  } else {
    str = fns.ensureString(str);
    sentences = tokenize(str);
  }
  var list = sentences.map(function (s) {
    return Terms.fromString(s, world);
  });

  var doc = new Text(list, world);
  //give each ts a ref to the result
  doc.list.forEach(function (ts) {
    ts.refText = doc;
  });
  return doc;
};
module.exports = fromString;

},{"./index":192,"./paths":205,"./tokenize":207}],191:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  /** did it find anything? */
  found: function found() {
    return this.list.length > 0;
  },
  /** just a handy wrap*/
  parent: function parent() {
    return this.original || this;
  },
  /** how many Texts are there?*/
  length: function length() {
    return this.list.length;
  },
  /** nicer than constructor.call.name or whatever*/
  isA: function isA() {
    return 'Text';
  },
  /** the whitespace before and after this match*/
  whitespace: function whitespace() {
    var _this = this;

    return {
      before: function before(str) {
        _this.list.forEach(function (ts) {
          ts.whitespace.before(str);
        });
        return _this;
      },
      after: function after(str) {
        _this.list.forEach(function (ts) {
          ts.whitespace.after(str);
        });
        return _this;
      }
    };
  }
};

},{}],192:[function(_dereq_,module,exports){
'use strict';
//a Text is an array of termLists

var getters = _dereq_('./getters');

function Text(arr, world, original) {
  this.list = arr || [];
  if (typeof world === 'function') {
    world = world();
  }
  this.world = function () {
    return world;
  };
  this.original = original;
  //apply getters
  var keys = Object.keys(getters);
  for (var i = 0; i < keys.length; i++) {
    Object.defineProperty(this, keys[i], {
      get: getters[keys[i]]
    });
  }
}
module.exports = Text;

Text.addMethods = function (cl, obj) {
  var fns = Object.keys(obj);
  for (var i = 0; i < fns.length; i++) {
    cl.prototype[fns[i]] = obj[fns[i]];
  }
};

//make a sub-class of this class easily
Text.makeSubset = function (methods, find) {
  var Subset = function Subset(arr, world, original) {
    Text.call(this, arr, world, original);
  };
  //inheritance
  Subset.prototype = Object.create(Text.prototype);
  Text.addMethods(Subset, methods);
  Subset.find = find;
  return Subset;
};

//apply instance methods
_dereq_('./methods/misc')(Text);
_dereq_('./methods/loops')(Text);
_dereq_('./methods/match')(Text);
_dereq_('./methods/out')(Text);
_dereq_('./methods/sort')(Text);
_dereq_('./methods/split')(Text);
_dereq_('./methods/normalize')(Text);
_dereq_('./subsets')(Text);

//apply subset methods
var subset = {
  acronyms: _dereq_('../subset/acronyms'),
  adjectives: _dereq_('../subset/adjectives'),
  adverbs: _dereq_('../subset/adverbs'),
  contractions: _dereq_('../subset/contractions'),
  dates: _dereq_('../subset/dates'),
  nouns: _dereq_('../subset/nouns'),
  people: _dereq_('../subset/people'),
  sentences: _dereq_('../subset/sentences'),
  terms: _dereq_('../subset/terms'),
  possessives: _dereq_('../subset/possessives'),
  values: _dereq_('../subset/values'),
  verbs: _dereq_('../subset/verbs'),
  ngrams: _dereq_('../subset/ngrams'),
  startGrams: _dereq_('../subset/ngrams/startGrams'),
  endGrams: _dereq_('../subset/ngrams/endGrams')
};
Object.keys(subset).forEach(function (k) {
  Text.prototype[k] = function (num, arg) {
    var sub = subset[k];
    var m = sub.find(this, num, arg);
    return new subset[k](m.list, this.world, this.parent);
  };
});
//aliases
Text.prototype.words = Text.prototype.terms;

},{"../subset/acronyms":9,"../subset/adjectives":10,"../subset/adverbs":17,"../subset/contractions":23,"../subset/dates":25,"../subset/ngrams":35,"../subset/ngrams/endGrams":32,"../subset/ngrams/startGrams":36,"../subset/nouns":38,"../subset/people":49,"../subset/possessives":51,"../subset/sentences":52,"../subset/terms":58,"../subset/values":65,"../subset/verbs":75,"./getters":191,"./methods/loops":193,"./methods/match":194,"./methods/misc":195,"./methods/normalize":196,"./methods/out":197,"./methods/sort":202,"./methods/split":204,"./subsets":206}],193:[function(_dereq_,module,exports){
'use strict';
//this methods are simply loops around each termList object.

var methods = ['toTitleCase', 'toUpperCase', 'toLowerCase', 'toCamelCase', 'hyphenate', 'dehyphenate', 'trim', 'insertBefore', 'insertAfter', 'insertAt', 'replace', 'replaceWith', 'delete', 'lump', 'tagger',

// 'tag',
'unTag'];

var addMethods = function addMethods(Text) {
  methods.forEach(function (k) {
    Text.prototype[k] = function () {
      for (var i = 0; i < this.list.length; i++) {
        this.list[i][k].apply(this.list[i], arguments);
      }
      return this;
    };
  });

  //add an extra optimisation for tag method
  Text.prototype.tag = function () {
    //fail-fast optimisation
    if (this.list.length === 0) {
      return this;
    }
    for (var i = 0; i < this.list.length; i++) {
      this.list[i].tag.apply(this.list[i], arguments);
    }
    return this;
  };
};

module.exports = addMethods;

},{}],194:[function(_dereq_,module,exports){
'use strict';

var syntaxParse = _dereq_('../../../terms/match/lib/syntax');
var Terms = _dereq_('../../../terms');

var splitMethods = function splitMethods(Text) {
  //support "#Noun word" regex-matches
  var matchReg = function matchReg(r, reg, verbose) {
    //parse the 'regex' into some json
    var list = [];
    reg = syntaxParse(reg);
    r.list.forEach(function (ts) {
      //an array of arrays
      var matches = ts.match(reg, verbose);
      matches.list.forEach(function (ms) {
        list.push(ms);
      });
    });
    var parent = r.parent || r;
    return new Text(list, r.world(), parent);
  };

  //support {word:true} whitelist
  var matchObj = function matchObj(r, obj) {
    var matches = [];
    r.list.forEach(function (ts) {
      ts.terms.forEach(function (t) {
        if (obj.hasOwnProperty(t.normal) === true) {
          matches.push(t);
        }
      });
    });
    matches = matches.map(function (t) {
      return new Terms([t], r.world(), r, t.parentTerms);
    });
    return new Text(matches, r.world(), r.parent);
  };

  //support [word, word] whitelist
  var matchArr = function matchArr(r, arr) {
    //its faster this way
    var obj = arr.reduce(function (h, a) {
      h[a] = true;
      return h;
    }, {});
    return matchObj(r, obj);
  };

  //take a Text object as a match
  var matchTextObj = function matchTextObj(r, m) {
    var arr = m.out('array'); //i guess this is fine..
    return matchArr(r, arr);
  };

  var methods = {
    /** do a regex-like search through terms and return a subset */
    match: function match(reg, verbose) {
      //fail-fast
      if (this.list.length === 0 || reg === undefined || reg === null) {
        var parent = this.parent || this;
        return new Text([], this.world(), parent);
      }
      //match "#Noun word" regex
      if (typeof reg === 'string' || typeof reg === 'number') {
        return matchReg(this, reg, verbose);
      }
      //match [word, word] whitelist
      var type = Object.prototype.toString.call(reg);
      if (type === '[object Array]') {
        return matchArr(this, reg);
      }
      //match {word:true} whitelist
      if (type === '[object Object]') {
        if (reg.isA === 'Text') {
          return matchTextObj(this, reg);
        } else {
          return matchObj(this, reg);
        }
      }
      return this;
    },

    not: function not(reg, verbose) {
      var list = [];
      this.list.forEach(function (ts) {
        var found = ts.not(reg, verbose);
        list = list.concat(found.list);
      });
      var parent = this.parent || this;
      return new Text(list, this.world(), parent);
    },

    if: function _if(reg) {
      var list = [];
      for (var i = 0; i < this.list.length; i++) {
        if (this.list[i].has(reg) === true) {
          list.push(this.list[i]);
        }
      }
      var parent = this.parent || this;
      return new Text(list, this.world(), parent);
    },

    ifNo: function ifNo(reg) {
      var list = [];
      for (var i = 0; i < this.list.length; i++) {
        if (this.list[i].has(reg) === false) {
          list.push(this.list[i]);
        }
      }
      var parent = this.parent || this;
      return new Text(list, this.world(), parent);
    },

    has: function has(reg) {
      for (var i = 0; i < this.list.length; i++) {
        if (this.list[i].has(reg) === true) {
          return true;
        }
      }
      return false;
    },

    /**find a match, and return everything infront of it*/
    before: function before(reg) {
      var list = [];
      for (var i = 0; i < this.list.length; i++) {
        var m = this.list[i].matchOne(reg);
        if (m) {
          var index = m[0].index();
          var found = this.list[i].slice(0, index);
          if (found.length > 0) {
            list.push(found);
          }
        }
      }
      var parent = this.parent || this;
      return new Text(list, this.world(), parent);
    },

    /**find a match, and return everything after of it*/
    after: function after(reg) {
      var list = [];
      for (var i = 0; i < this.list.length; i++) {
        var m = this.list[i].matchOne(reg);
        if (m) {
          var lastTerm = m[m.length - 1];
          var index = lastTerm.index();
          var found = this.list[i].slice(index + 1, this.list[i].length);
          if (found.length > 0) {
            list.push(found);
          }
        }
      }
      var parent = this.parent || this;
      return new Text(list, this.world(), parent);
    }
  };
  //alias 'and'
  methods.and = methods.match;
  methods.notIf = methods.ifNo;
  methods.only = methods.if;
  methods.onlyIf = methods.if;

  //hook them into result.proto
  Text.addMethods(Text, methods);
  return Text;
};

module.exports = splitMethods;

},{"../../../terms":165,"../../../terms/match/lib/syntax":175}],195:[function(_dereq_,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var Terms = _dereq_('../../terms');

var miscMethods = function miscMethods(Text) {
  var methods = {
    all: function all() {
      return this.parent;
    },
    index: function index() {
      return this.list.map(function (ts) {
        return ts.index();
      });
    },
    wordCount: function wordCount() {
      return this.terms().length;
    },
    data: function data() {
      return this.list.map(function (ts) {
        return ts.data();
      });
    },
    /* javascript array loop-wrappers */
    map: function map(fn) {
      var _this = this;

      return this.list.map(function (ts, i) {
        var text = new Text([ts], _this.world);
        return fn(text, i);
      });
    },
    forEach: function forEach(fn) {
      var _this2 = this;

      this.list.forEach(function (ts, i) {
        var text = new Text([ts], _this2.world);
        fn(text, i);
      });
      return this;
    },
    filter: function filter(fn) {
      var _this3 = this;

      var list = this.list.filter(function (ts, i) {
        var text = new Text([ts], _this3.world);
        return fn(text, i);
      });
      return new Text(list, this.world);
    },
    reduce: function reduce(fn, h) {
      var _this4 = this;

      return this.list.reduce(function (_h, ts) {
        var text = new Text([ts], _this4.world);
        return fn(_h, text);
      }, h);
    },
    find: function find(fn) {
      for (var i = 0; i < this.list.length; i++) {
        var ts = this.list[i];
        var text = new Text([ts], this.world);
        if (fn(text)) {
          return text;
        }
      }
      return undefined;
    },
    /**copy data properly so later transformations will have no effect*/
    clone: function clone() {
      var list = this.list.map(function (ts) {
        return ts.clone();
      });
      return new Text(list, this.world); //this.lexicon, this.parent
    },

    /** get the nth term of each result*/
    term: function term(n) {
      var _this5 = this;

      var list = this.list.map(function (ts) {
        var arr = [];
        var el = ts.terms[n];
        if (el) {
          arr = [el];
        }
        return new Terms(arr, _this5.world, _this5.refText, _this5.refTerms);
      });
      return new Text(list, this.world, this.parent);
    },
    firstTerm: function firstTerm() {
      return this.match('^.');
    },
    lastTerm: function lastTerm() {
      return this.match('.$');
    },

    /** grab a subset of the results*/
    slice: function slice(start, end) {
      this.list = this.list.slice(start, end);
      return this;
    },

    /** use only the nth result*/
    get: function get(n) {
      //return an empty result
      if (!n && n !== 0 || !this.list[n]) {
        return new Text([], this.world, this.parent);
      }
      var ts = this.list[n];
      return new Text([ts], this.world, this.parent);
    },
    /**use only the first result */
    first: function first(n) {
      if (!n && n !== 0) {
        return this.get(0);
      }
      return new Text(this.list.slice(0, n), this.world, this.parent);
    },
    /**use only the last result */
    last: function last(n) {
      if (!n && n !== 0) {
        return this.get(this.list.length - 1);
      }
      var end = this.list.length;
      var start = end - n;
      return new Text(this.list.slice(start, end), this.world, this.parent);
    },

    concat: function concat() {
      //any number of params
      for (var i = 0; i < arguments.length; i++) {
        var p = arguments[i];
        if ((typeof p === 'undefined' ? 'undefined' : _typeof(p)) === 'object') {
          //Text()
          if (p.isA === 'Text' && p.list) {
            this.list = this.list.concat(p.list);
          }
          //Terms()
          if (p.isA === 'Terms') {
            this.list.push(p);
          }
        }
      }
      return this;
    },

    /** make it into one sentence/termlist */
    flatten: function flatten() {
      var terms = [];
      this.list.forEach(function (ts) {
        terms = terms.concat(ts.terms);
      });
      //dont create an empty ts
      if (!terms.length) {
        return new Text(null, this.world, this.parent);
      }
      var ts = new Terms(terms, this.world, this, null);
      return new Text([ts], this.world, this.parent);
    },

    /** see if these terms can become this tag*/
    canBe: function canBe(tag) {
      this.list.forEach(function (ts) {
        ts.terms = ts.terms.filter(function (t) {
          return t.canBe(tag);
        });
      });
      return this;
    },

    /** sample part of the array */
    random: function random(n) {
      n = n || 1;
      var r = Math.floor(Math.random() * this.list.length);
      var arr = this.list.slice(r, r + n);
      //if we're off the end, add some from the start
      if (arr.length < n) {
        var diff = n - arr.length;
        if (diff > r) {
          diff = r; //prevent it from going full-around
        }
        arr = arr.concat(this.list.slice(0, diff));
      }
      return new Text(arr, this.world, this.parent);
    },
    setPunctuation: function setPunctuation(punct) {
      this.list.forEach(function (ts) {
        return ts.setPunctuation(punct);
      });
      return this;
    },
    getPunctuation: function getPunctuation(num) {
      //support num param
      if (num || num === 0) {
        if (!this.list[num]) {
          return '';
        }
        return this.list[num].getPunctuation();
      }
      return this.list.map(function (ts) {
        return ts.getPunctuation();
      });
    },
    //jquery-like api aliases
    offset: function offset() {
      return this.out('offset');
    },
    text: function text() {
      return this.out('text');
    }
  };
  //aliases
  methods.eq = methods.get;
  methods.join = methods.flatten;
  Text.addMethods(Text, methods);
};

module.exports = miscMethods;

},{"../../terms":165}],196:[function(_dereq_,module,exports){
'use strict';

var _unicode = _dereq_('../../term/methods/normalize/unicode');
//
var defaults = {
  whitespace: true,
  case: true,
  numbers: true,
  punctuation: true,
  unicode: true,
  contractions: true,
  acronyms: true,

  parentheses: false,
  possessives: false,
  plurals: false,
  verbs: false,
  honorifics: false
};

var methods = {
  /** make only one space between each word */
  whitespace: function whitespace(r) {
    r.terms().list.forEach(function (ts, i) {
      var t = ts.terms[0];
      if (i > 0 && !t.silent_term) {
        t.whitespace.before = ' ';
      } else if (i === 0) {
        t.whitespace.before = '';
      }
      t.whitespace.after = '';
      //add normalized quotation symbols
      if (t.tags.StartQuotation === true) {
        t.whitespace.before += '"';
      }
      if (t.tags.EndQuotation === true) {
        t.whitespace.after = '"' + t.whitespace.after;
      }
    });
    return r;
  },

  /** make first-word titlecase, and people, places titlecase */
  case: function _case(r) {
    r.list.forEach(function (ts) {
      ts.terms.forEach(function (t, i) {
        if (i === 0 || t.tags.Person || t.tags.Place || t.tags.Organization) {
          // ts.toTitleCase() //fixme: too weird here.
        } else {
          ts.toLowerCase();
        }
      });
    });
    return r;
  },

  /** turn 'five' to 5, and 'fifth' to 5th*/
  numbers: function numbers(r) {
    r.values().toNumber();
    return r;
  },

  /** remove commas, semicolons - but keep sentence-ending punctuation*/
  punctuation: function punctuation(r) {
    r.list.forEach(function (ts) {
      if (!ts.terms.length) {
        return;
      }

      //first-term punctuation
      ts.terms[0]._text = ts.terms[0]._text.replace(/^¿/, '');
      //middle-terms
      for (var i = 0; i < ts.terms.length - 1; i++) {
        var t = ts.terms[i];
        //remove non-sentence-ending stuff
        t._text = t._text.replace(/[:;,]$/, '');
      }
      //replace !!! with !
      var last = ts.terms[ts.terms.length - 1];
      last._text = last._text.replace(/\.+$/, '.');
      last._text = last._text.replace(/!+$/, '!');
      last._text = last._text.replace(/\?+!?$/, '?'); //support '?!'
    });
    return r;
  },

  // turn Björk into Bjork
  unicode: function unicode(r) {
    r.list.forEach(function (ts) {
      ts.terms.forEach(function (t) {
        t.text = _unicode(t.text);
      });
    });
    return r;
  },

  //expand all contractions
  contractions: function contractions(r) {
    r.contractions().expand();
    return r;
  },
  //remove periods from acronyms, like F.B.I.
  acronyms: function acronyms(r) {
    r.acronyms().stripPeriods();
    return r;
  },
  //turn david's → david
  possessives: function possessives(r) {
    r.possessives().strip();
    return r;
  },
  //strip out parts in (brackets)
  parentheses: function parentheses(r) {
    r.parentheses().delete();
    return r;
  },
  //turn sandwhiches → sandwhich
  plurals: function plurals(r) {
    //todo:this has a non-cooperative bug
    r.nouns().toSingular();
    return r;
  },
  //turn ate → eat
  verbs: function verbs(r) {
    r.verbs().toInfinitive();
    return r;
  },

  //turn 'Sergeant Pepper to 'Pepper'
  honorifics: function honorifics(r) {
    r = r.delete('#Honorific');
    return r;
  }
};

var addMethods = function addMethods(Text) {
  Text.prototype.normalize = function (options) {
    var doc = this;
    //set defaults
    options = options || {};
    var obj = Object.assign({}, defaults);
    var keys = Object.keys(options);
    keys.forEach(function (k) {
      obj[k] = options[k];
    });
    //do each type of normalization
    Object.keys(obj).forEach(function (fn) {
      if (obj[fn] && methods[fn] !== undefined) {
        doc = methods[fn](doc);
      }
    });
    return doc;
  };
};
module.exports = addMethods;

},{"../../term/methods/normalize/unicode":151}],197:[function(_dereq_,module,exports){
'use strict';

var _topk = _dereq_('./topk');
var offset = _dereq_('./offset');
var termIndex = _dereq_('./indexes');
var fns = _dereq_('../paths').fns;

var methods = {
  text: function text(r) {
    return r.list.reduce(function (str, ts) {
      str += ts.out('text');
      return str;
    }, '');
  },
  match: function match(r) {
    return r.list.reduce(function (str, ts) {
      str += ts.out('match');
      return str;
    }, '');
  },
  normal: function normal(r) {
    return r.list.map(function (ts) {
      var str = ts.out('normal');
      var last = ts.last();
      if (last) {
        var punct = ts.getPunctuation();
        if (punct === '.' || punct === '!' || punct === '?') {
          str += punct;
        }
      }
      return str;
    }).join(' ');
  },
  root: function root(r) {
    return r.list.map(function (ts) {
      return ts.out('root');
    }).join(' ');
  },
  /** output where in the original output string they are*/
  offsets: function offsets(r) {
    return offset(r);
  },
  /** output the tokenized location of this match*/
  index: function index(r) {
    return termIndex(r);
  },
  grid: function grid(r) {
    return r.list.reduce(function (str, ts) {
      str += ts.out('grid');
      return str;
    }, '');
  },
  color: function color(r) {
    return r.list.reduce(function (str, ts) {
      str += ts.out('color');
      return str;
    }, '');
  },
  array: function array(r) {
    return r.list.map(function (ts) {
      return ts.out('normal');
    });
  },
  csv: function csv(r) {
    return r.list.map(function (ts) {
      return ts.out('csv');
    }).join('\n');
  },
  newlines: function newlines(r) {
    return r.list.map(function (ts) {
      return ts.out('newlines');
    }).join('\n');
  },
  json: function json(r) {
    return r.list.reduce(function (arr, ts) {
      var terms = ts.terms.map(function (t) {
        return {
          text: t.text,
          normal: t.normal,
          tags: t.tag
        };
      });
      arr.push(terms);
      return arr;
    }, []);
  },
  html: function html(r) {
    var html = r.list.reduce(function (str, ts) {
      var sentence = ts.terms.reduce(function (sen, t) {
        sen += '\n    ' + t.out('html');
        return sen;
      }, '');
      return str += '\n  <span>' + sentence + '\n  </span>';
    }, '');
    return '<span> ' + html + '\n</span>';
  },
  terms: function terms(r) {
    var arr = [];
    r.list.forEach(function (ts) {
      ts.terms.forEach(function (t) {
        arr.push({
          text: t.text,
          normal: t.normal,
          tags: Object.keys(t.tags)
        });
      });
    });
    return arr;
  },
  debug: function debug(r) {
    console.log('====');
    r.list.forEach(function (ts) {
      console.log('   --');
      ts.debug();
    });
    return r;
  },
  topk: function topk(r) {
    return _topk(r);
  },
  custom: function custom(r, obj) {
    return r.list.map(function (ts) {
      return ts.out(obj);
    });
  }
};
methods.plaintext = methods.text;
methods.normalized = methods.normal;
methods.colors = methods.color;
methods.tags = methods.terms;
methods.offset = methods.offsets;
methods.idexes = methods.index;
methods.frequency = methods.topk;
methods.freq = methods.topk;
methods.arr = methods.array;

var addMethods = function addMethods(Text) {
  Text.prototype.out = function (fn) {
    if (typeof fn === 'string') {
      if (methods[fn]) {
        return methods[fn](this);
      }
    } else if (fns.isObject(fn) === true) {
      //support .out({})
      return methods.custom(this, fn);
    }
    return methods.text(this);
  };
  Text.prototype.debug = function () {
    return methods.debug(this);
  };
  return Text;
};

module.exports = addMethods;

},{"../paths":201,"./indexes":198,"./offset":199,"./topk":200}],198:[function(_dereq_,module,exports){
'use strict';
//find where in the original text this match is found, by term-counts

var termIndex = function termIndex(r) {
  var result = [];
  //find the ones we want
  var want = {};
  r.terms().list.forEach(function (ts) {
    want[ts.terms[0].uid] = true;
  });

  //find their counts
  var sum = 0;
  var parent = r.all();
  parent.list.forEach(function (ts, s) {
    ts.terms.forEach(function (t, i) {
      if (want[t.uid] !== undefined) {
        result.push({
          text: t.text,
          normal: t.normal,
          term: sum,
          sentence: s,
          sentenceTerm: i
        });
      }
      sum += 1;
    });
  });

  return result;
};
module.exports = termIndex;

},{}],199:[function(_dereq_,module,exports){
'use strict';
/** say where in the original output string they are found*/

var findOffset = function findOffset(parent, term) {
  var sum = 0;
  for (var i = 0; i < parent.list.length; i++) {
    for (var o = 0; o < parent.list[i].terms.length; o++) {
      var t = parent.list[i].terms[o];
      if (t.uid === term.uid) {
        return sum;
      } else {
        sum += t.whitespace.before.length + t._text.length + t.whitespace.after.length;
      }
    }
  }
  return null;
};

//like 'text' for the middle, and 'normal' for the start+ends
//used for highlighting the actual words, without whitespace+punctuation
var trimEnds = function trimEnds(ts) {
  var terms = ts.terms;
  if (terms.length <= 2) {
    return ts.out('normal');
  }
  //the start
  var str = terms[0].normal;
  //the middle
  for (var i = 1; i < terms.length - 1; i++) {
    var t = terms[i];
    str += t.whitespace.before + t.text + t.whitespace.after;
  }
  //the end
  str += ' ' + terms[ts.terms.length - 1].normal;
  return str;
};

//map over all-dem-results
var allOffset = function allOffset(r) {
  var parent = r.all();
  return r.list.map(function (ts) {
    var words = [];
    for (var i = 0; i < ts.terms.length; i++) {
      words.push(ts.terms[i].normal);
    }
    var nrml = trimEnds(ts);
    var txt = ts.out('text');
    var startAt = findOffset(parent, ts.terms[0]);
    var beforeWord = ts.terms[0].whitespace.before;
    var wordStart = startAt + beforeWord.length;
    return {
      text: txt,
      normal: ts.out('normal'),
      //where we begin
      offset: startAt,
      length: txt.length,
      wordStart: wordStart,
      wordEnd: wordStart + nrml.length
      // wordLength: words.join(' ').length
    };
  });
};
module.exports = allOffset;

},{}],200:[function(_dereq_,module,exports){
'use strict';
//

var topk = function topk(r, n) {
  //count occurance
  var count = {};
  r.list.forEach(function (ts) {
    var str = ts.out('root');
    count[str] = count[str] || 0;
    count[str] += 1;
  });
  //turn into an array
  var all = [];
  Object.keys(count).forEach(function (k) {
    all.push({
      normal: k,
      count: count[k]
    });
  });
  //add percentage
  all.forEach(function (o) {
    o.percent = parseFloat((o.count / r.list.length * 100).toFixed(2));
  });
  //sort by freq
  all = all.sort(function (a, b) {
    if (a.count > b.count) {
      return -1;
    }
    return 1;
  });
  if (n) {
    all = all.splice(0, n);
  }
  return all;
};

module.exports = topk;

},{}],201:[function(_dereq_,module,exports){
'use strict';

module.exports = _dereq_('../paths');

},{"../paths":205}],202:[function(_dereq_,module,exports){
'use strict';

var sorter = _dereq_('./methods');

var addMethods = function addMethods(Text) {

  var fns = {

    /**reorder result.list alphabetically */
    sort: function sort(method) {
      //default sort
      method = method || 'alphabetical';
      method = method.toLowerCase();
      if (!method || method === 'alpha' || method === 'alphabetical') {
        return sorter.alpha(this, Text);
      }
      if (method === 'chron' || method === 'chronological') {
        return sorter.chron(this, Text);
      }
      if (method === 'length') {
        return sorter.lengthFn(this, Text);
      }
      if (method === 'freq' || method === 'frequency') {
        return sorter.freq(this, Text);
      }
      if (method === 'wordcount') {
        return sorter.wordCount(this, Text);
      }
      return this;
    },

    /**reverse the order of result.list */
    reverse: function reverse() {
      this.list = this.list.reverse();
      return this;
    },

    unique: function unique() {
      var obj = {};
      this.list = this.list.filter(function (ts) {
        var str = ts.out('root');
        if (obj.hasOwnProperty(str)) {
          return false;
        }
        obj[str] = true;
        return true;
      });
      return this;
    }
  };
  //hook them into result.proto
  Text.addMethods(Text, fns);
  return Text;
};

module.exports = addMethods;

},{"./methods":203}],203:[function(_dereq_,module,exports){
'use strict';

//perform sort on pre-computed values

var sortEm = function sortEm(arr) {
  arr = arr.sort(function (a, b) {
    if (a.index > b.index) {
      return 1;
    }
    if (a.index === b.index) {
      return 0;
    }
    return -1;
  });
  //return ts objects
  return arr.map(function (o) {
    return o.ts;
  });
};

//alphabetical sorting of a termlist array
exports.alpha = function (r) {
  r.list.sort(function (a, b) {
    //#1 performance speedup
    if (a === b) {
      return 0;
    }
    //#2 performance speedup
    if (a.terms[0] && b.terms[0]) {
      if (a.terms[0].root > b.terms[0].root) {
        return 1;
      }
      if (a.terms[0].root < b.terms[0].root) {
        return -1;
      }
    }
    //regular compare
    if (a.out('root') > b.out('root')) {
      return 1;
    }
    return -1;
  });
  return r;
};

//the order they were recieved (chronological~)
exports.chron = function (r) {
  //pre-compute indexes
  var tmp = r.list.map(function (ts) {
    return {
      ts: ts,
      index: ts.termIndex()
    };
  });
  r.list = sortEm(tmp);
  return r;
};

//shortest matches first
exports.lengthFn = function (r) {
  //pre-compute indexes
  var tmp = r.list.map(function (ts) {
    return {
      ts: ts,
      index: ts.chars()
    };
  });
  r.list = sortEm(tmp).reverse();
  return r;
};

//count the number of terms in each match
exports.wordCount = function (r) {
  //pre-compute indexes
  var tmp = r.list.map(function (ts) {
    return {
      ts: ts,
      index: ts.length
    };
  });
  r.list = sortEm(tmp);
  return r;
};

//sort by frequency (like topk)
exports.freq = function (r) {
  //get counts
  var count = {};
  r.list.forEach(function (ts) {
    var str = ts.out('root');
    count[str] = count[str] || 0;
    count[str] += 1;
  });
  //pre-compute indexes
  var tmp = r.list.map(function (ts) {
    var num = count[ts.out('root')] || 0;
    return {
      ts: ts,
      index: num * -1 //quick-reverse it
    };
  });
  r.list = sortEm(tmp);
  return r;
};

},{}],204:[function(_dereq_,module,exports){
'use strict';

var splitMethods = function splitMethods(Text) {

  var methods = {
    /** turn result into two seperate results */
    splitAfter: function splitAfter(reg, verbose) {
      var list = [];
      this.list.forEach(function (ts) {
        ts.splitAfter(reg, verbose).forEach(function (mts) {
          list.push(mts);
        });
      });
      this.list = list;
      return this;
    },
    /** turn result into two seperate results */
    splitBefore: function splitBefore(reg, verbose) {
      var list = [];
      this.list.forEach(function (ts) {
        ts.splitBefore(reg, verbose).forEach(function (mts) {
          list.push(mts);
        });
      });
      this.list = list;
      return this;
    },
    /** turn result into two seperate results */
    splitOn: function splitOn(reg, verbose) {
      var list = [];
      this.list.forEach(function (ts) {
        ts.splitOn(reg, verbose).forEach(function (mts) {
          list.push(mts);
        });
      });
      this.list = list;
      return this;
    }
  };

  //hook them into result.proto
  Text.addMethods(Text, methods);
  return Text;
};

module.exports = splitMethods;

},{}],205:[function(_dereq_,module,exports){
arguments[4][201][0].apply(exports,arguments)
},{"../paths":8,"dup":201}],206:[function(_dereq_,module,exports){
'use strict';

var isQuestion = _dereq_('../subset/sentences/isQuestion');
var addSubsets = function addSubsets(Text) {
  //these subsets have no instance methods, so are simply a 'find' method.
  var subsets = {
    clauses: function clauses(n) {
      var r = this.splitAfter('#ClauseEnd');
      if (typeof n === 'number') {
        r = r.get(n);
      }
      return r;
    },
    hashTags: function hashTags(n) {
      var r = this.match('#HashTag').terms();
      if (typeof n === 'number') {
        r = r.get(n);
      }
      return r;
    },
    organizations: function organizations(n) {
      var r = this.splitAfter('#Comma');
      r = r.match('#Organization+');
      if (typeof n === 'number') {
        r = r.get(n);
      }
      return r;
    },
    phoneNumbers: function phoneNumbers(n) {
      var r = this.splitAfter('#Comma');
      r = r.match('#PhoneNumber+');
      if (typeof n === 'number') {
        r = r.get(n);
      }
      return r;
    },
    places: function places(n) {
      var r = this.splitAfter('#Comma');
      r = r.match('#Place+');
      if (typeof n === 'number') {
        r = r.get(n);
      }
      return r;
    },
    quotations: function quotations(n) {
      var matches = this.match('#Quotation+');
      var found = [];
      matches.list.forEach(function (ts) {
        var open = 0;
        var start = null;
        //handle nested quotes - 'startQuote->startQuote->endQuote->endQuote'
        ts.terms.forEach(function (t, i) {
          if (t.tags.StartQuotation === true) {
            if (open === 0) {
              start = i;
            }
            open += 1;
          }
          if (open > 0 && t.tags.EndQuotation === true) {
            open -= 1;
          }
          if (open === 0 && start !== null) {
            found.push(ts.slice(start, i + 1));
            start = null;
          }
        });
        //maybe we messed something up..
        if (start !== null) {
          found.push(ts.slice(start, ts.terms.length));
        }
      });
      matches.list = found;
      if (typeof n === 'number') {
        matches = matches.get(n);
      }
      return matches;
    },
    topics: function topics(n) {
      var r = this.clauses();
      // Find people, places, and organizations
      var yup = r.people();
      yup.concat(r.places());
      yup.concat(r.organizations());
      var ignore = ['someone', 'man', 'woman', 'mother', 'brother', 'sister', 'father'];
      yup = yup.not(ignore);
      //return them to normal ordering
      yup.sort('chronological');
      // yup.unique() //? not sure
      if (typeof n === 'number') {
        yup = yup.get(n);
      }
      return yup;
    },
    urls: function urls(n) {
      var r = this.match('#Url');
      if (typeof n === 'number') {
        r = r.get(n);
      }
      return r;
    },
    questions: function questions(n) {
      var r = this.all();
      if (typeof n === 'number') {
        r = r.get(n);
      }
      var list = r.list.filter(function (ts) {
        return isQuestion(ts);
      });
      return new Text(list, this.world, this.parent);
    },
    statements: function statements(n) {
      var r = this.all();
      if (typeof n === 'number') {
        r = r.get(n);
      }
      var list = r.list.filter(function (ts) {
        return isQuestion(ts) === false;
      });
      return new Text(list, this.world, this.parent);
    },
    parentheses: function parentheses(n) {
      var r = this.match('#Parentheses+');
      //split-up consecutive ones
      r = r.splitAfter('#EndBracket');
      if (typeof n === 'number') {
        r = r.get(n);
      }
      return r;
    }
  };

  Object.keys(subsets).forEach(function (k) {
    Text.prototype[k] = subsets[k];
  });
  return Text;
};
module.exports = addSubsets;

},{"../subset/sentences/isQuestion":53}],207:[function(_dereq_,module,exports){
//(Rule-based sentence boundary segmentation) - chop given text into its proper sentences.
// Ignore periods/questions/exclamations used in acronyms/abbreviations/numbers, etc.
// @spencermountain 2017 MIT
"use strict";

var abbreviations = Object.keys(_dereq_("../world/more-data/abbreviations"));
// \u203D - Interrobang
// \u2E18 - Inverted Interrobang
// \u203C - Double Exclamation Mark
// \u2047 - Double Question Mark
// \u2048 - Question Exclamation Mark
// \u2049 - Exclamation Question Mark
// \u2026 - Ellipses Character

//regs-
var abbrev_reg = new RegExp("\\b(" + abbreviations.join("|") + ")[.!?\u203D\u2E18\u203C\u2047-\u2049] *$", "i");
var acronym_reg = /[ .][A-Z]\.? *$/i;
var ellipses_reg = /(?:\u2026|\.{2,}) *$/;

// Match different formats of new lines. (Mac: \r, Linux: \n, Windows: \r\n)
var new_line = /((?:\r?\n|\r)+)/;
var naiive_sentence_split = /(\S.+?[.!?\u203D\u2E18\u203C\u2047-\u2049])(?=\s+|$)/g;

var letter_regex = /[a-z]/i;
var not_ws_regex = /\S/;

// Start with a regex:
var naiive_split = function naiive_split(text) {
  var all = [];
  //first, split by newline
  var lines = text.split(new_line);
  for (var i = 0; i < lines.length; i++) {
    //split by period, question-mark, and exclamation-mark
    var arr = lines[i].split(naiive_sentence_split);
    for (var o = 0; o < arr.length; o++) {
      all.push(arr[o]);
    }
  }
  return all;
};

var sentence_parser = function sentence_parser(text) {
  text = text || "";
  text = String(text);
  var sentences = [];
  // First do a greedy-split..
  var chunks = [];
  // Ensure it 'smells like' a sentence
  if (!text || typeof text !== "string" || not_ws_regex.test(text) === false) {
    return sentences;
  }
  // Start somewhere:
  var splits = naiive_split(text);
  // Filter-out the grap ones
  for (var i = 0; i < splits.length; i++) {
    var s = splits[i];
    if (s === undefined || s === "") {
      continue;
    }
    //this is meaningful whitespace
    if (not_ws_regex.test(s) === false) {
      //add it to the last one
      if (chunks[chunks.length - 1]) {
        chunks[chunks.length - 1] += s;
        continue;
      } else if (splits[i + 1]) {
        //add it to the next one
        splits[i + 1] = s + splits[i + 1];
        continue;
      }
    }
    //else, only whitespace, no terms, no sentence
    chunks.push(s);
  }

  //detection of non-sentence chunks:
  //loop through these chunks, and join the non-sentence chunks back together..
  for (var _i = 0; _i < chunks.length; _i++) {
    var c = chunks[_i];
    //should this chunk be combined with the next one?
    if (chunks[_i + 1] && letter_regex.test(c) && (abbrev_reg.test(c) || acronym_reg.test(c) || ellipses_reg.test(c))) {
      chunks[_i + 1] = c + (chunks[_i + 1] || "");
    } else if (c && c.length > 0 && letter_regex.test(c)) {
      //this chunk is a proper sentence..
      sentences.push(c);
      chunks[_i] = "";
    }
  }
  //if we never got a sentence, return the given text
  if (sentences.length === 0) {
    return [text];
  }
  return sentences;
};

module.exports = sentence_parser;
// console.log(sentence_parser('john f. kennedy'));

},{"../world/more-data/abbreviations":216}],208:[function(_dereq_,module,exports){
"use strict";

module.exports = "{\"words\":\"Comparative\xA6better|Superlative\xA6earlier|PresentTense\xA6sounds|Value\xA6a few|Noun\xA6autumn,daylight9eom,here,no doubt,one d8s5t2w0yesterd8;eek0int5;d6end;mr1o0;d4morrow;!w;ome 1tandard3umm0;er;d0point;ay; time|Copula\xA6a1is,w0;as,ere;m,re|Condition\xA6if,unless|PastTense\xA6be2came,d1had,mea0sa1taken,we0;nt;id;en,gan|Gerund\xA6accord0be0develop0go0result0stain0;ing|Negative\xA6n0;ever,o0;!n,t|QuestionWord\xA6how3wh0;at,e1ich,o0y;!m,se;n,re; come,'s|Singular\xA6a05bYcTdPeNfKgJhFici09jel06kitty,lEmCnBoAp7question mark,r6s4t1us 0;dollUstV; rex,a1h0ic,ragedy,v show;ere,i06;l02x return;ky,tu0uper bowl,yst05;dIff;alZi02oom;a1robl02u0;dCrpo8;rt,tE;cean,thers;othiXumbG;ayfTeeNo0;del,nopoS;iRunch;ead start,o0;lPme1u0;se;! run;adfMirlIlaci8od,rand slam,ulM;amiLly,olLr1un0;diN;iGosD;conomy,gg,ner3v0xampG;ent;eath,inn2o0ragonfG;cument6g0iFlFor;gy;er;an3eiliFhocol2i0ottage,redit card;ty,vil w0;ar;ate;ary;ankiAel7les9o2reakfast,u0;n0tterf6;ti8;dy,tt2y0;fri0;end;le;d1l0noma0;ly; homin2verti0;si0;ng;em|Infinitive\xA60:6Y;1:7C;2:7A;3:79;4:5F;5:74;6:6D;7:6L;8:78;9:6W;A:73;B:76;C:6R;D:68;E:7D;F:60;a6Qb69c5Bd4Je43f3Qg3Jh3Ci2Zj2Xk2Tl2Km2Bn28o24p1Pques3Rr0Xs05tWuRvOwHyG;awn,ield;aJe24hist7iIoGre6H;nd0rG;k,ry;n,pe,sh,th0;lk,nHrGsh,tCve;n,raE;d0t;aHiGo8;ew,sA;l6Rry;nHpGr3se;gra4Wli49;dGi8lo65;erGo;go,mi5H;aNeMhKie,oJrHuGwi5;ne,rn;aGe0Ui60u5y;de,in,nsf0p,v5O;r37uC;ank,rG;eat2Vi2;nd,st;ke,lk,rg5Os8;a06c03eZhWi4Jkip,lVmUneTo56pQtJuGwitC;bmAck,ff0gge5ppHrGspe6;ge,pri1rou53vi2;ly,o3D;aLeKoJrHuG;dy,mb7;aDeGi2;ngth2Lss,tC;p,re;m,p;in,ke,r0Yy;iHlaFoil,rinG;g,k7;n,t;ak,e3E;aFe22i7o5B;am,e1Qip;aHiv0oG;ck,ut;re,ve;arCeIle6nHr2tG;!t7;d,se;k,m;aHo4rG;atCew;le,re;il,ve;a05eIisk,oHuG;b,in,le,n,sh;am,ll;a01cZdu9fYgXje6lUmTnt,pQquPsKtJvGwa5V;eGiew,o4U;al,l,rG;se,t;aDi4u42;eJi5oItG;!o4rG;i6uc20;l2rt;mb7nt,r2;e5i4;air,eHlGo40reseE;a9y;at;aDemb0i3Wo2;aHeGi2y;a1nt;te,x;a5Dr4A;act1Yer,le6u1;a12ei2k5PoGyc7;gni2Cnci7rd;ch,li2Bs5N;i1nG;ge,k;aTerSiRlPoNrIuG;b21ll,mp,rGsh,t;cha1s4Q;ai1eJiEoG;cHdu9greBhibAmi1te5vG;e,i2U;eBlaim;di6pa4ss,veE;iEp,rtr43sGur;e,t;a3RuG;g,n3;ck,le;fo32mAsi5;ck,iErt4Mss,u1y;bIccur,ff0pera8utweHverGwe;co47lap,ta3Qu1whelm;igh;ser2taD;eHotG;e,i9;ed,gle6;aLeKiIoHuG;ltip3Frd0;nit14ve;nGrr13;d,g7us;asu4lt,n0Qr3ssa3;intaDke d40na3rHtG;ch,t0;ch,k39ry;aMeLiIoGu1F;aGck,ok,ve;d,n;ft,ke,mAnHstGve;!en;e,k;a2Gc0Ht;b0Qck,uG;gh,nC;eIiHnoG;ck,w;ck,ll,ss;ep;am,oDuG;d3mp;gno4mQnGss3I;cOdica8flu0NhNsKtIvG;eGol2;nt,st;erGrodu9;a6fe4;i5tG;aGru6;ll;abAibA;lu1Fr1D;agi22pG;lemeEo20ro2;aKeIi4oHuG;nt,rry;ld fa5n03pe,st;aGlp;d,t;nd7ppGrm,te;en;aLet,loBoKrIuG;arGeBi14;ant39d;aGip,ow,umb7;b,sp;es,ve1I;in,th0ze;aQeaPiNlLoIracHuncG;ti3I;tu4;cus,lHrG;ce,eca5m,s30;d,l22;aFoG;at,od,w;gu4lGniFx;e,l;r,tu4;il,ll,vG;or;a13cho,dAle6mSnPstNvalua8xG;a0AcLerKi5pGte16;a15eHlaDoGreB;rt,se;ct,riG;en9;ci1t;el,han3;abGima8;liF;ab7couXdHfor9ga3han9j03riCsu4t0vG;isi2Vy;!u4;body,er3pG;hasiGow0;ze;a06eUiMoLrHuG;mp;aIeHiGop;ft;am,ss;g,in;!d3ubt;e,ff0p,re6sHvG;e,iXor9;aJcGli13miBpl18tinguiF;oGuB;uGv0;ra3;gr1YppG;ear,ro2;al,cNem,fLliv0ma0Cny,pKsHterG;mi0D;cribe,er2iHtrG;oy;gn,re;a08e07i6osA;eGi08y;at,ct;iIlHrG;ea1;a4i04;de;ma3n9re,te;a0Ae09h06i8l03oJrGut;aHeGoBuFy;a8dA;ck,ve;llYmSnHok,py,uGv0;gh,nt;cePdu6fMsKtIvG;eGin9;rt,y;aDin0XrG;a5ibu8ol;iGtitu8;d0st;iHoGroE;rm;gu4rm;rn;biKe,foJmaIpG;a4laD;re;nd;rt;ne;ap1e6;aHiGo1;ng,p;im,w;aHeG;at,ck,w;llen3n3r3se;a1nt0;ll,ncHrGt0u1;e,ry;el;aUeQloPoNrKuG;dgIlHrG;n,y;ly;et;aHuF;sh;ke;a5mb,o5rrGth0un9;ow;ck;ar,coSgDlHnefAtrG;ay;ie2ong;in;nGse;!g;band0Jc0Bd06ffo05gr04id,l01mu1nYppTrQsKttGvoid,waA;acIeHra6;ct;m0Fnd;h,k;k,sG;eIiHocia8uG;me;gn,st;mb7rt;le;chHgGri2;ue;!i2;eaJlIroG;aCve;ch;aud,y;l,r;noun9sw0tG;icipa8;ce;lHt0;er;e3ow;ee;rd;aRdIju5mAoR;it;st;!reB;ss;cJhie2knowled3tiva8;te;ge;ve;eIouEu1;se;nt;pt;on|Actor\xA6aJbGcFdCengineIfAgardenIh9instructPjournalLlawyIm8nurse,opeOp5r3s1t0;echnCherapK;ailNcientJoldiGu0;pervKrgeon;e0oofE;ceptionGsearC;hotographClumbColi1r0sychologF;actitionBogrammB;cem6t5;echanic,inist9us4;airdress8ousekeep8;arm7ire0;fight6m2;eputy,iet0;ici0;an;arpent2lerk;ricklay1ut0;ch0;er;ccoun6d2ge7r0ssis6ttenda7;chitect,t0;ist;minist1v0;is1;rat0;or;ta0;nt|Honorific\xA6aObrigadiNcHdGexcellency,fiBking,liDmaAofficNp6queen,r3s0taoiseach,vice5;e0ultJ;c0rgeaC;ond liAretary;abbi,e0;ar0verend; adJ;astFr0;eside6i0ofessE;me ministEnce0;!ss;gistrate,r4yB;eld mar3rst l0;ady,i0;eutena0;nt;shA;oct5utchess;aptain,hance3o0;lonel,mmand4ngress0unci2;m0wom0;an;ll0;or;er;d0yatullah;mir0;al|SportsTeam\xA60:1M;1:1T;2:1U;a1Rb1Dc0Zd0Qfc dallas,g0Nhouston 0Mindiana0Ljacksonville jagua0k0Il0Fm02newVoRpKqueens parkJrIsAt5utah jazz,vancouver whitecaps,w3yY;ashington 3est ham0Xh16;natio21redski1wizar12;ampa bay 6e5o3;ronto 3ttenham hotspur;blu1Hrapto0;nnessee tita1xasD;buccanee0ra1G;a7eattle 5heffield0Qporting kansas13t3;. louis 3oke12;c1Srams;mari02s3;eah1IounI;cramento Sn 3;antonio spu0diego 3francisco gi0Bjose earthquak2;char0EpaB;eal salt lake,o04; ran0C;a8h5ittsburgh 4ortland t3;imbe0rail blaze0;pirat2steele0;il3oenix su1;adelphia 3li2;eagl2philNunE;dr2;akland 4klahoma city thunder,r3;i10lando magic;athle0Trai3;de0; 3castle05;england 6orleans 5york 3;city fc,giUje0Lkn02me0Lred bul19y3;anke2;pelica1sain0J;patrio0Irevolut3;ion;aBe9i3ontreal impact;ami 7lwaukee b6nnesota 3;t4u0Rvi3;kings;imberwolv2wi1;re0Cuc0W;dolphi1heat,marli1;mphis grizz3ts;li2;nchester 5r3vN;i3li1;ne0;c00u0H;a4eicesterYos angeles 3;clippe0dodFlaA; galaxy,ke0;ansas city 3nH;chiefs,ro3;ya0M; pace0polis colX;astr0Edynamo,rockeWtexa1;i4olden state warrio0reen bay pac3;ke0;anT;.c.Aallas 7e3i0Cod5;nver 5troit 3;lio1pisto1ti3;ge0;bronc06nuggeO;cowboUmav3;er3;ic06; uX;arCelNh8incinnati 6leveland 5ol3;orado r3umbus crew sc;api5ocki2;brow1cavalie0india1;benga03re3;ds;arlotte horCicago 3;b4cubs,fire,wh3;iteE;ea0ulY;di3olina panthe0;ff3naW; c3;ity;altimore ElAoston 7r3uffalo bilT;av2e5ooklyn 3;ne3;ts;we0;cel4red3; sox;tics;ackburn rove0u3;e ja3;ys;rs;ori3rave1;ol2;rizona Ast8tlanta 3;brav2falco1h4u3;nited;aw9;ns;es;on villa,r3;os;c5di3;amondbac3;ks;ardi3;na3;ls|Uncountable\xA60:1C;a1Hb1Bc12e0Wf0Qg0Mh0Gi0Dj0Cknowled1Gl07mYnXoWpRrOsCt8vi7w1;a5ea0Ai4o1;o2rld1;! seI;d,l;ldlife,ne;rmth,t0;neg0Xol08;e3hund0ime,oothpaste,r1una;affRou1;ble,sers,t;a,nnis;aAcene07e9h8il7now,o6p3te2u1;g0Rnshi0L;am,el;ace2e1;ciOed;!c12;ap,cc0ft0B;k,v0;eep,opp0O;riJ;d07fe0Wl1nd;m0Qt;ain,e1i0W;c1laxa0Csearch;ogni0Brea0B;a4e2hys0Elast9o1ress00;rk,w0;a1pp0trol;ce,nR;p0tiK;il,xygen;ews,oi0C;a7ea5i4o3u1;mps,s1;ic;nHo08;lk,st;sl1t;es;chine1il,themat00; learn02ry;aught0e3i2u1;ck,g07;ghtnZqu0CteratI;a1isH;th0;ewel7usti08;ce,mp1nformaOtself;ati1ortan06;en05;a4isto3o1;ck1mework,n1spitali01;ey;ry;ir,lib1ppi9;ut;o2r1um,ymnastJ;a7ound;l1ssip;d,f;i5lour,o2ruit,urnit1;ure;od,rgive1wl;ne1;ss;c6sh;conom9duca5lectriciMn3quip4th9very1;body,o1thB;ne;joy1tertain1;ment;tiC;a8elcius,h4iv3loth6o1urrency;al,ffee,ld w1nfusiAttA;ar;ics;aos,e1;e2w1;ing;se;ke,sh;a3eef,is2lood,read,utt0;er;on;g1ss;ga1;ge;c4dvi3irc2mnes1rt;ty;raft;ce;id|Unit\xA60:17;a12b10c0Md0Le0Jf0Fg0Bh08in07joule0k01lZmOnNoMpIqHsqCt7volts,w6y4z3\xB02\xB51;g,s;c,f,n;b,e2;a0Lb,d0Rears old,o1;tt0F;att0b;able4b3e2on1sp;!ne0;a2r0B;!l,sp;spo03; ft,uare 1;c0Gd0Ff3i0Dkilo0Hm1ya0C;e0Kil1;e0li0F;eet0o0B;t,uart0;a3e2i1ou0Nt;c0Knt0;rcent,t00;!scals;hms,uVz;an0GewtR;/s,b,e7g,i3l,m2p1\xB2,\xB3;h,s;!\xB2;!/h,cro3l1;e1li05;! DsC\xB2;g05s0A;gPter1;! 2s1;! 1;per second;b,iZm,u1x;men0x0;b,elvin0g,ilo2m1nQ;!/h,ph,\xB2;byYgWmeter1;! 2s1;! 1;per hour;\xB2,\xB3;e1g,z;ct1rtz0;aWogP;al2b,ig9ra1;in0m0;!l1;on0;a3emtOl1tG; oz,uid ou1;nce0;hrenheit0rad0;b,x1;abyH;eciCg,l,mA;arat0eAg,l,m9oulomb0u1;bic 1p0;c5d4fo3i2meAya1;rd0;nch0;ot0;eci2;enti1;me4;!\xB2,\xB3;lsius0nti1;g2li1me1;ter0;ram0;bl,y1;te0;c4tt1;os1;eco1;nd0;re0;!s|Pronoun\xA6'em,elle,h4i3me,ourselves,she5th1us,we,you0;!rself;e0ou;m,y;!l,t;e0im;!'s|Organization\xA60:44;a39b2Qc2Ad22e1Yf1Ug1Mh1Hi1Ej1Ak18l14m0Tn0Go0Dp07qu06rZsStFuBv8w3y1;amaha,m0You1w0Y;gov,tu2R;a3e1orld trade organizati3Z;lls fargo,st1;fie23inghou17;l1rner br3B;-m12gree30l street journ25m12;an halNeriz3Uisa,o1;dafo2Gl1;kswagLvo;bs,kip,n2ps,s1;a tod2Qps;es33i1;lev2Wted natio2T; mobi2Jaco bePd bMeAgi frida9h3im horto2Smz,o1witt2V;shiba,y1;ota,s r Y;e 1in lizzy;b3carpen31daily ma2Vguess w2holli0rolling st1Ns1w2;mashing pumpki2Nuprem0;ho;ea1lack eyed pe3Dyrds;ch bo1tl0;ys;l2s1;co,la m13;efoni08us;a6e4ieme2Fnp,o2pice gir5ta1ubaru;rbucks,to2L;ny,undgard1;en;a2Px pisto1;ls;few24insbu25msu1W;.e.m.,adiohead,b6e3oyal 1yan2V;b1dutch she4;ank;/max,aders dige1Ed 1vl30;bu1c1Thot chili peppe2Ilobst27;ll;c,s;ant2Tizno2D;an5bs,e3fiz23hilip morrBi2r1;emier25octer & gamb1Qudenti14;nk floyd,zza hut;psi26tro1uge09;br2Ochina,n2O; 2ason1Wda2E;ld navy,pec,range juli2xf1;am;us;aAb9e5fl,h4i3o1sa,wa;kia,tre dame,vart1;is;ke,ntendo,ss0L;l,s;c,stl3tflix,w1; 1sweek;kids on the block,york09;e,\xE9;a,c;nd1Rs2t1;ional aca2Co,we0P;a,cYd0N;aAcdonald9e5i3lb,o1tv,yspace;b1Knsanto,ody blu0t1;ley crue,or0N;crosoft,t1;as,subisO;dica3rcedes2talli1;ca;!-benz;id,re;'s,s;c's milk,tt11z1V;'ore08a3e1g,ittle caesa1H;novo,x1;is,mark; pres5-z-boy,bour party;atv,fc,kk,m1od1H;art;iffy lu0Jo3pmorgan1sa;! cha1;se;hnson & johns1Py d1O;bm,hop,n1tv;g,te1;l,rpol; & m,asbro,ewlett-packaSi3o1sbc,yundai;me dep1n1G;ot;tac1zbollah;hi;eneral 6hq,l5mb,o2reen d0Gu1;cci,ns n ros0;ldman sachs,o1;dye1g09;ar;axo smith kliYencore;electr0Gm1;oto0S;a3bi,da,edex,i1leetwood mac,oFrito-l08;at,nancial1restoU; tim0;cebook,nnie mae;b04sa,u3xxon1; m1m1;ob0E;!rosceptics;aiml08e5isney,o3u1;nkin donuts,po0Tran dur1;an;j,w j1;on0;a,f leppa2ll,peche mode,r spiegXstiny's chi1;ld;rd;aEbc,hBi9nn,o3r1;aigsli5eedence clearwater reviv1ossra03;al;ca c5l4m1o08st03;ca2p1;aq;st;dplLgate;ola;a,sco1tigroup;! systems;ev2i1;ck fil-a,na daily;r0Fy;dbury,pital o1rl's jr;ne;aFbc,eBf9l5mw,ni,o1p,rexiteeV;ei3mbardiJston 1;glo1pizza;be;ng;ack & deckFo2ue c1;roW;ckbuster video,omingda1;le; g1g1;oodriM;cht3e ge0n & jer2rkshire hathaw1;ay;ryG;el;nana republ3s1xt5y5;f,kin robbi1;ns;ic;bWcRdidQerosmith,ig,lKmEnheuser-busDol,pple9r6s3t&t,v2y1;er;is,on;hland1sociated F; o1;il;by4g2m1;co;os; compu2bee1;'s;te1;rs;ch;c,d,erican3t1;!r1;ak; ex1;pre1;ss; 4catel2t1;air;!-luce1;nt;jazeera,qae1;da;as;/dc,a3er,t1;ivisi1;on;demy of scienc0;es;ba,c|Demonym\xA60:16;1:13;a0Wb0Nc0Cd0Ae09f07g04h02iYjVkTlPmLnIomHpDqatari,rBs7t5u4v3wel0Rz2;am0Fimbabwe0;enezuel0ietnam0H;g9krai1;aiwThai,rinida0Iu2;ni0Qrkmen;a4cot0Ke3ingapoOlovak,oma0Tpa05udRw2y0X;edi0Kiss;negal0Br08;mo0uU;o6us0Lw2;and0;a3eru0Hhilipp0Po2;li0Ertugu06;kist3lesti1na2raguay0;ma1;ani;amiZi2orweP;caragu0geri2;an,en;a3ex0Mo2;ngo0Erocc0;cedo1la2;gasy,y08;a4eb9i2;b2thua1;e0Dy0;o,t02;azakh,eny0o2uwaiti;re0;a2orda1;ma0Bp2;anN;celandic,nd4r2sraeli,ta02vo06;a2iT;ni0qi;i0oneV;aiDin2ondur0unN;di;amDe2hanai0reek,uatemal0;or2rm0;gi0;i2ren7;lipino,n4;cuadoVgyp6ngliJsto1thiopi0urope0;a2ominXut4;niH;a9h6o4roa3ub0ze2;ch;ti0;lom2ngol5;bi0;a6i2;le0n2;ese;lifor1m2na3;bo2eroo1;di0;angladeshi,el8o6r3ul2;gaG;aziBi2;ti2;sh;li2s1;vi0;aru2gi0;si0;fAl7merBngol0r5si0us2;sie,tr2;a2i0;li0;gent2me1;ine;ba1ge2;ri0;ni0;gh0r2;ic0;an|Region\xA6a20b1Sc1Id1Des1Cf19g13h10i0Xj0Vk0Tl0Qm0FnZoXpSqPrMsDtAut9v5w2y0zacatec22;o05u0;cat18kZ;a0est vir4isconsin,yomi14;rwick1Qshington0;! dc;er2i0;cto1Ir0;gin1R;acruz,mont;ah,tar pradesh;a1e0laxca1Cusca9;nnessee,x1Q;bas0Jmaulip1PsmI;a5i3o1taf0Nu0ylh12;ffUrrZs0X;me0Zno19uth 0;cRdQ;ber1Hc0naloa;hu0Rily;n1skatchew0Qxo0;ny; luis potosi,ta catari1H;a0hode6;j0ngp01;asth0Lshahi;inghai,u0;e0intana roo;bec,ensVreta0D;ara3e1rince edward0; isT;i,nnsylv0rnambu01;an13;!na;axa0Mdisha,h0klaho1Antar0reg3x03;io;ayarit,eAo2u0;evo le0nav0K;on;r0tt0Qva scot0W;f5mandy,th0; 0ampton0P;c2d1yo0;rk0N;ako0X;aroli0U;olk;bras0Wva00w0; 1foundland0;! and labrador;brunswick,hamp0Gjers0mexiIyork state;ey;a5i1o0;nta0Mrelos;ch2dlanAn1ss0;issippi,ouri;as geraFneso0L;igPoacP;dhya,harasht03ine,ni2r0ssachusetts;anhao,y0;land;p0toba;ur;anca03e0incoln03ouis7;e0iG;ds;a0entucky,hul09;ns07rnata0Cshmir;alis0iangxi;co;daho,llino1nd0owa;ia04;is;a1ert0idalDun9;fordS;mpRwaii;ansu,eorgVlou4u0;an1erre0izhou,jarat;ro;ajuato,gdo0;ng;cesterL;lori1uji0;an;da;sex;e3o1uran0;go;rs0;et;lawaDrbyC;a7ea6hi5o0umbrG;ahui3l2nnectic1rsi0ventry;ca;ut;iLorado;la;apDhuahua;ra;l7m0;bridge2peche;a4r3uck0;ingham0;shi0;re;emen,itish columb2;h1ja cal0sque,var1;iforn0;ia;guascalientes,l3r0;izo1kans0;as;na;a1ber0;ta;ba1s0;ka;ma|Possessive\xA6anyAh5its,m3noCo1sometBthe0yo1;ir1mselves;ur0;!s;i8y0;!se4;er1i0;mse2s;!s0;!e0;lf;o1t0;hing;ne|Currency\xA6$,aud,bRcPdKeurJfIgbp,hkd,inr,jpy,kGlEp8r7s3usd,x2y1z0\xA2,\xA3,\xA5,\u0434\u0435\u043D,\u043B\u0432,\u0440\u0443\u0431,\u0E3F,\u20A1,\u20A8,\u20AC,\u20AD,\uFDFC;lotyR\u0142;en,uanQ;af,of;h0t5;e0il5;k0q0;elL;iel,oubleKp,upeeK;e2ound st0;er0;lingH;n0soG;ceFn0;ies,y;e0i7;i,mpi6;n,r0wanzaByatB;!onaAw;ori7ranc9t;!o8;en3i2kk,o0;b0ll2;ra5;me4n0rham4;ar3;ad,e0ny;nt1;aht,itcoin0;!s|Country\xA60:38;1:2L;a2Wb2Dc21d1Xe1Rf1Lg1Bh19i13j11k0Zl0Um0Gn05om3CpZqat1JrXsKtCu6v4wal3yemTz2;a24imbabwe;es,lis and futu2X;a2enezue31ietnam;nuatu,tican city;.5gTkraiZnited 3ruXs2zbeE;a,sr;arab emirat0Kkingdom,states2;! of am2X;k.,s.2; 27a.;a7haBimor-les0Bo6rinidad4u2;nis0rk2valu;ey,me2Xs and caic1T; and 2-2;toba1J;go,kel0Ynga;iw2Vji2nz2R;ki2T;aCcotl1eBi8lov7o5pa2Bri lanka,u4w2yr0;az2ed9itzerl1;il1;d2Qriname;lomon1Vmal0uth 2;afr2IkLsud2O;ak0en0;erra leoEn2;gapo1Wt maart2;en;negKrb0ychellY;int 2moa,n marino,udi arab0;hele24luc0mart1Z;epublic of ir0Com2Cuss0w2;an25;a3eHhilippinTitcairn1Ko2uerto riM;l1rtugE;ki2Bl3nama,pua new0Tra2;gu6;au,esti2;ne;aAe8i6or2;folk1Gth3w2;ay; k2ern mariana1B;or0M;caragua,ger2ue;!ia;p2ther18w zeal1;al;mib0u2;ru;a6exi5icro09o2yanm04;ldova,n2roc4zamb9;a3gol0t2;enegro,serrat;co;c9dagascZl6r4urit3yot2;te;an0i14;shall0Vtin2;ique;a3div2i,ta;es;wi,ys0;ao,ed00;a5e4i2uxembourg;b2echtenste10thu1E;er0ya;ban0Gsotho;os,tv0;azakh1De2iriba02osovo,uwait,yrgyz1D;eling0Jnya;a2erF;ma15p1B;c6nd5r3s2taly,vory coast;le of m19rael;a2el1;n,q;ia,oI;el1;aiSon2ungary;dur0Mg kong;aAermany,ha0Pibralt9re7u2;a5ern4inea2ya0O;!-biss2;au;sey;deloupe,m,tema0P;e2na0M;ce,nl1;ar;bTmb0;a6i5r2;ance,ench 2;guia0Dpoly2;nes0;ji,nl1;lklandTroeT;ast tim6cu5gypt,l salv5ngl1quatorial3ritr4st2thiop0;on0; guin2;ea;ad2;or;enmark,jibou4ominica3r con2;go;!n B;ti;aAentral african 9h7o4roat0u3yprQzech2; 8ia;ba,racao;c3lo2morPngo-brazzaville,okFsta r03te d'ivoiK;mb0;osD;i2ristmasF;le,na;republic;m2naTpe verde,yman9;bod0ero2;on;aFeChut00o8r4u2;lgar0r2;kina faso,ma,undi;azil,itish 2unei;virgin2; is2;lands;liv0nai4snia and herzegoviGtswaGuvet2; isl1;and;re;l2n7rmuF;ar2gium,ize;us;h3ngladesh,rbad2;os;am3ra2;in;as;fghaFlCmAn5r3ustr2zerbaijH;al0ia;genti2men0uba;na;dorra,g4t2;arct6igua and barbu2;da;o2uil2;la;er2;ica;b2ger0;an0;ia;ni2;st2;an|City\xA6a2Wb26c1Wd1Re1Qf1Og1Ih1Ai18jakar2Hk0Zl0Tm0Gn0Co0ApZquiYrVsLtCuBv8w3y1z0;agreb,uri1Z;ang1Te0okohama;katerin1Hrev34;ars3e2i0rocl3;ckl0Vn0;nipeg,terth0W;llingt1Oxford;aw;a1i0;en2Hlni2Z;lenc2Uncouv0Gr2G;lan bat0Dtrecht;a6bilisi,e5he4i3o2rondheim,u0;nVr0;in,ku;kyo,ronIulouC;anj23l13miso2Jra2A; haJssaloni0X;gucigalpa,hr2Ol av0L;i0llinn,mpe2Bngi07rtu;chu22n2MpT;a3e2h1kopje,t0ydney;ockholm,uttga12;angh1Fenzh1X;o0KvZ;int peters0Ul3n0ppo1F; 0ti1B;jo0salv2;se;v0z0Q;adU;eykjavik,i1o0;me,t25;ga,o de janei17;to;a8e6h5i4o2r0ueb1Qyongya1N;a0etor24;gue;rt0zn24; elizabe3o;ls1Grae24;iladelph1Znom pe07oenix;r0tah tik19;th;lerJr0tr10;is;dessa,s0ttawa;a1Hlo;a2ew 0is;delTtaip0york;ei;goya,nt0Upl0Uv1R;a5e4i3o1u0;mb0Lni0I;nt0scH;evideo,real;l1Mn01skolc;dell\xEDn,lbour0S;drid,l5n3r0;ib1se0;ille;or;chest0dalWi0Z;er;mo;a4i1o0vAy01;nd00s angel0F;ege,ma0nz,sbZverpo1;!ss0;ol; pla0Iusan0F;a5hark4i3laipeda,o1rak0uala lump2;ow;be,pavog0sice;ur;ev,ng8;iv;b3mpa0Kndy,ohsiu0Hra0un03;c0j;hi;ncheMstanb0\u0307zmir;ul;a5e3o0; chi mi1ms,u0;stI;nh;lsin0rakliG;ki;ifa,m0noi,va0A;bu0SiltD;alw4dan3en2hent,iza,othen1raz,ua0;dalaj0Gngzhou;bu0P;eUoa;sk;ay;es,rankfu0;rt;dmont4indhovU;a1ha01oha,u0;blRrb0Eshanbe;e0kar,masc0FugavpiJ;gu,je0;on;a7ebu,h2o0raioJuriti01;lo0nstanJpenhagNrk;gFmbo;enn3i1ristchur0;ch;ang m1c0ttagoL;ago;ai;i0lgary,pe town,rac4;ro;aHeBirminghWogoAr5u0;char3dap3enos air2r0sZ;g0sa;as;es;est;a2isba1usse0;ls;ne;silPtisla0;va;ta;i3lgrade,r0;g1l0n;in;en;ji0rut;ng;ku,n3r0sel;celo1ranquil0;la;na;g1ja lu0;ka;alo0kok;re;aBb9hmedabad,l7m4n2qa1sh0thens,uckland;dod,gabat;ba;k0twerp;ara;m5s0;terd0;am;exandr0maty;ia;idj0u dhabi;an;lbo1rh0;us;rg|Place\xA6aMbKcIdHeFfEgBhAi9jfk,kul,l7m5new eng4ord,p2s1the 0upJyyz;bronx,hamptons;fo,oho,under2yd;acifMek,h0;l,x;land;a0co,idDuc;libu,nhattK;a0gw,hr;s,x;ax,cn,ndianGst;arlem,kg,nd;ay village,re0;at 0enwich;britain,lak2;co,ra;urope,verglad0;es;en,fw,own1xb;dg,gk,hina0lt;town;cn,e0kk,rooklyn;l air,verly hills;frica,m5ntar1r1sia,tl0;!ant1;ct0;ic0; oce0;an;ericas,s|FemaleName\xA60:G0;1:G4;2:FT;3:FF;4:FE;5:ER;6:FU;7:ET;8:GH;9:F1;A:GD;B:E7;C:EI;D:FQ;E:GA;F:FN;G:C8;aE4bD6cB9dAJe9Hf92g8Ih85i7Uj6Wk61l4Pm3An2Vo2Sp2Hqu2Fr1Ps0Rt05ursu7vVwPyMzH;aKeIoH;e,la,ra;lHna;da,ma;da,ra;as7GeIol1UvH;et5onBA;le0sen3;an9endBPhiB5iH;lJnH;if3BniHo0;e,f3A;a,helmi0lHma;a,ow;aNeKiH;cIviH;an9YenG4;kD1tor3;da,l8Wnus,rH;a,nHoniD4;a,iDE;leHnesEF;nDOrH;i1y;aTeQhOiNoKrHu7y4;acG6iHu0F;c3na,sH;h9Nta;nIrH;a,i;i9Kya;a5KffaCIna,s6;al3eHomasi0;a,l8Ho6Zres1;g7Vo6YrIssH;!a,ie;eCi,ri8;bOliNmLnJrIs6tHwa0;ia0um;a,yn;iHya;a,ka,s6;a4e4iHmCCra;!ka;a,t6;at6it6;a06carlet2Ze05hViTkye,oRtNuIyH;bFMlvi1;e,sIzH;an2Uet5ie,y;anHi8;!a,e,nH;aFe;aJeH;fHl3EphH;an2;cFBr73;f3nHphi1;d4ia,ja,ya;er4lv3mon1nHobh76;dy;aLeHirlBNo0y7;ba,e0i7lJrH;iHrBRyl;!d71;ia,lBX;ki4nJrIu0w0yH;la,na;i,leAon,ron;a,da,ia,nHon;a,on;l60re0;bNdMi9lLmJndIrHs6vannaF;aFi0;ra,y;aHi4;nt6ra;lBPome;e,ie;in1ri0;a03eYhWiUoIuH;by,thBM;bRcQlPnOsIwe0xH;an95ie,y;aIeHie,lE;ann8ll1marBHtB;!lHnn1;iHyn;e,nH;a,d7X;da,i,na;an9;hel55io;bin,erByn;a,cHkki,na,ta;helC2ki;ea,iannE0oH;da,n13;an0bJgi0i0nHta,y0;aHee;!e,ta;a,eH;cATkaF;chHe,i0mo0n5FquCGvDy0;aCFelHi9;!e,le;een2iH;a0nn;aNeMhKoJrH;iHudenAX;scil1Uyamva9;lly,rt3;ilome0oebe,ylH;is,lis;arl,ggy,nelope,r7t4;ige,m0Fn4Po7rvaBDtIulH;a,et5in1;ricHsy,tA9;a,e,ia;ctav3deIf86lHph86;a,ga,iv3;l3t5;aReQiKoHy7;eIrH;aFeDma;ll1mi;aLcJkHla,na,s6ta;iHki;!ta;hoB4k8ColH;a,eBJ;!mh;l7Una,risC;dJi5PnIo23taH;li1s6;cy,et5;eAiCQ;a01ckenz2eViLoIrignayani,uriBIyrH;a,na,tAV;i4ll9ZnH;a,iH;ca,ka,qB7;a,chPkaOlKmi,nJrHtzi;aHiam;!n9;a,dy,erva,h,n2;a,dJi9LlH;iHy;cent,e;red;!e7;ae7el3I;ag4LgLi,lIrH;edi62isCyl;an2iHliC;nHsAP;a,da;!an,han;b09c9Gd07e,g05i04l02n00rLtKuIv6TxGyHz2;a,bell,ra;de,rH;a,eD;h77il9t2;a,cTgPiKjor2l6Jn2s6tJyH;!aHbe5RjaAlou;m,n9V;a,ha,i0;!aJbAOeIja,lEna,sHt54;!a,ol,sa;!l07;!h,m,nH;!a,e,n1;arJeIie,oHr3Lueri5;!t;!ry;et3JiB;elHi62y;a,l1;dHon,ue7;akranBy;iHlo97;a,ka,n9;a,re,s2;daHg2;!l2Y;alEd2elHge,isBJon0;eiAin1yn;el,le;a0Je09iXoRuLyH;d3la,nH;!a,dIe9VnHsAT;!a,e9U;a,sAR;aB4cKelJiClIna,pHz;e,iB;a,u;a,la;iHy;a2Ce,l27n9;is,l1IrItt2uH;el7is1;aJeIi8na,rH;aGi8;lei,n1tB;!in1;aRbQd3lMnJsIv3zH;!a,be4Let5z2;a,et5;a,dH;a,sHy;ay,ey,i,y;a,iaJlH;iHy;a8Je;!n4G;b7Verty;!n5T;aOda,e0iMla,nLoJslAUtHx2;iHt2;c3t3;la,nHra;a,ie,o4;a,or1;a,gh,laH;!ni;!h,nH;a,d4e,n4O;cOdon7Ui7kes6na,rNtLurJvIxHy7;mi;ern1in3;a,eHie,yn;l,n;as6is6oH;nya,ya;a,isC;ey,ie,y;a01eWhadija,iOoNrJyH;lHra;a,ee,ie;isHy5D;!tH;a,en,iHy;!e,n48;ri,urtn9C;aNerMl9BmJrHzzy;a,stH;en,in;!berlH;eHi,y;e,y;a,stD;!na,ra;el6QiKlJnIrH;a,i,ri;d4na;ey,i,l9Ss2y;ra,s6;c8Yi5YlPma7nyakumari,rNss5MtKviByH;!e,lH;a,eH;e,i7A;a5FeIhHi3PlEri0y;arGerGie,leDr9Hy;!lyn75;a,en,iHl4Vyn;!ma,n31sC;ei74i,l2;a05eWilUoNuH;anLdKliHstG;aIeHsC;!nAt0W;!n8Z;e,i2Ry;a,iB;!anMcelEd5Wel73han6JlKni,sIva0yH;a,ce;eHie;fi0lEphG;eHie;en,n1;!a,e,n36;!i10lH;!i0Z;anMle0nJrIsH;i5Rsi5R;i,ri;!a,el6Rif1RnH;a,et5iHy;!e,f1P;a,e74iInH;a,e73iH;e,n1;cMd1mi,nIqueliAsmin2Uvie4yAzH;min8;a8eIiH;ce,e,n1s;!lHsCt06;e,le;inIk2lEquelH;in1yn;da,ta;da,lQmOnNo0rMsIvaH;!na;aIiHob6W;do4;!belHdo4;!a,e,l2G;en1i0ma;a,di4es,gr5T;el9ogH;en1;a,eAia0o0se;aNeKilIoHyacin1N;ll2rten1H;a5HdHla5H;a,egard;ath0XiIlHnrietBrmiAst0X;en25ga;di;il78lLnKrHtt2yl78z6G;iHmo4Hri4I;etH;!te;aFnaF;ey,l2;aZeUiPlNold13rJwH;enHyne19;!dolE;acIetHisel9;a,chD;e,ieH;!la;adys,enHor3yn1Z;a,da,na;aKgi,lIna,ov74selH;a,e,le;da,liH;an;!n0;mZnJorgIrH;aldGi,m2Utru76;et5i5W;a,eHna;s1Ovieve;briel3Hil,le,rnet,yle;aSePio0loNrH;anIe9iH;da,e9;!cH;esIiHoi0H;n1s3X;!ca;!rH;a,en45;lIrnH;!an9;ec3ic3;rItiHy8;ma;ah,rah;d0GileDkBl01mVn4DrSsNtMuLvH;aJelIiH;e,ta;in0Byn;!ngelG;geni1la,ni3T;h55ta;meral9peranKtH;eIhHrel7;er;l2Rr;za;iHma,nestGyn;cHka,n;a,ka;eKilJmH;aHie,y;!liA;ee,i1y;lHrald;da,y;aUeSiNlMma,no4oKsJvH;a,iH;na,ra;a,ie;iHuiH;se;a,en,ie,y;a0c3da,nKsHzaI;aHe;!beH;th;!a,or;anor,nH;!a;in1na;en,iHna,wi0;e,th;aXeLiKoHul2W;lor54miniq41n32rHtt2;a,eDis,la,othHthy;ea,y;an0AnaFonAx2;anQbPde,eOiMja,lJmetr3nHsir4X;a,iH;ce,se;a,iIla,orHphiA;es,is;a,l5M;dHrdH;re;!d4Pna;!b2EoraFra;a,d4nH;!a,e;hl3i0mNnLphn1rIvi1YyH;le,na;a,by,cIia,lH;a,en1;ey,ie;a,et5iH;!ca,el1Cka;arHia;is;a0Se0Oh06i04lWoKrIynH;di,th3;istHy06;al,i0;lQnNrIurH;tn1F;aKdJiHnJriA;!nH;a,e,n1;el3;!l1T;n2sH;tanHuelo;ce,za;eHleD;en,t5;aJeoIotH;il4D;!pat4;ir8rJudH;et5iH;a,ne;a,e,iH;ce,sY;a4er4ndH;i,y;aQeNloe,rH;isIyH;stal;sy,tH;aIen,iHy;!an1e,n1;!l;lseIrH;!i8yl;a,y;nMrH;isKlImH;aiA;a,eHot5;n1t5;!sa;d4el1RtH;al,el1Q;cIlH;es5i3H;el3ilH;e,ia,y;iZlYmilXndWrOsMtHy7;aKeJhHri0;erGleDrEy;in1;ri0;li0ri0;a2IsH;a2Hie;a,iNlLmeJolIrH;ie,ol;!e,in1yn;lHn;!a,la;a,eHie,y;ne,y;na,sC;a0Ei0E;a,e,l1;isBl2;tlH;in,yn;arb0DeZianYlWoUrH;andSeQiJoIyH;an0nn;nwEok8;an2PdgLg0KtH;n29tH;!aInH;ey,i,y;ny;etH;!t8;an0e,nH;da,na;i8y;bbi8nH;iBn2;ancHossom,ythe;a,he;ca;aScky,lin9niBrOssNtJulaFvH;!erlH;ey,y;hIsy,tH;e,i11y8;!anH;ie,y;!ie;nHt6yl;adIiH;ce;et5iA;!triH;ce,z;a4ie,ra;aliy2Bb26d1Ng1Ji1Bl0Um0Pn03rYsPthe0uLvJyH;anHes6;a,na;a,eHr27;ry;drJgusIrH;el3o4;ti0;a,ey,i,y;hItrH;id;aLlHt1Q;eIi8yH;!n;e,iHy;gh;!nH;ti;iJleIpiB;ta;en,n1t5;an1AelH;le;aZdXeVgRiPja,nItoHya;inet5n3;!aKeIiHmJ;e,ka;!mHt5;ar2;!belIliCmU;sa;!le;ka,sHta;a,sa;elHie;a,iH;a,ca,n1qH;ue;!t5;te;je7rea;la;!bImHstas3;ar3;el;aJberIel3iHy;e,na;!ly;l3n9;da;aUba,eOiLlJma,ta,yH;a,c3sH;a,on,sa;iHys0K;e,s0J;a,cIna,sHza;a,ha,on,sa;e,ia;c3is6jaJna,ssaJxH;aHia;!nd4;nd4;ra;ia;i0nIyH;ah,na;a,is,naF;c6da,leDmMnslLsH;haFlH;inHyX;g,n;!h;ey;ee;en;at6g2nH;es;ie;ha;aWdiTelMrH;eJiH;anMenH;a,e,ne;an0;na;aLeKiIyH;nn;a,n1;a,e;!ne;!iH;de;e,lEsH;on;yn;!lH;iAyn;ne;agaKbIiH;!gaJ;ey,i8y;!e;il;ah|Person\xA6a01bZcTdQeOfMgJhHinez,jFkEleDmAnettPo9p7r4s3t2uncle,v0womL;a0irgin maH;lentino rossi,n go3;heresa may,iger woods,yra banks;addam hussaQcarlett johanssRistZlobodan milosevic,omeone,tepGuC;ay romano,eese witherspoQo1ush limbau0;gh;d stewart,naldinho,sario;a0ipV;lmUris hiltM;prah winfrOra;an,essiaen,itt romnNo0ubarek;m0thR;!my;bron james,e;anye west,iefer sutherland,obe bryaN;aime,effersFk rowli0;ng;alle ber0ulk hog3;ry;astBentlem1irl,rand0uy;fa2mo2;an;a0ella;thF;ff0meril lagasse,zekiel;ie;a0enzel washingt4ick wolf,ude;d0lt3nte;!dy;ar2lint1ous0ruz;in;on;dinal wols1son0;! palm5;ey;arack obama,oy,ro0;!ck,th2;dolf hitl1shton kutch1u0;nt;er|WeekDay\xA6fri4mon4s2t1wed0;!nesd4;hurs2ues2;at0un1;!urd1;!d0;ay0;!s|Date\xA6autumn,daylight9eom,one d8s5t2w0yesterd8;eek0int5;d6end;mr1o0;d4morrow;!w;ome 1tandard3umm0;er;d0point;ay; time|Time\xA6a6breakfast 5dinner5e3lunch5m2n0oclock,some5to7;i7o0;on,w;id4or1;od,ve0;ning;time;fternoon,go,ll day,t 0;ni0;ght|Holiday\xA60:1Q;1:1P;a1Fb1Bc12d0Ye0Of0Kg0Hh0Di09june07kwanzaa,l04m00nYoVpRrPsFt9v6w4xm03y2;om 2ule;hasho16kippur;hit2int0Xomens equalit8; 0Ss0T;alentines3e2ictor1E;r1Bteran1;! 0;-0ax 0h6isha bav,rinityMu2; b3rke2;y 0;ish2she2;vat;a0Xe prophets birth0;a6eptember14h4imchat tor0Ut 3u2;kk4mmer T;a8p7s6valentines day ;avu2mini atzeret;ot;int 2mhain;a4p3s2valentine1;tephen1;atrick1;ndrew1;amadan,ememberanc0Yos2;a park1h hashana;a3entecost,reside0Zur2;im,ple heart 0;lm2ssovE; s04;rthodox 2stara;christma1easter2goOhoJn0C;! m07;ational 2ew years09;freedom 0nurse1;a2emorial 0lHoOuharram;bMr2undy thurs0;ch0Hdi gr2tin luther k0B;as;a2itRughnassadh;bour 0g baom2ilat al-qadr;er; 2teenth;soliU;d aJmbolc,n2sra and miraj;augurGd2;ependen2igenous people1;c0Bt1;a3o2;ly satur0;lloween,nukkUrvey mil2;k 0;o3r2;ito de dolores,oundhoW;odW;a4east of 2;our lady of guadalupe,the immaculate concepti2;on;ther1;aster8id 3lectYmancip2piphany;atX;al-3u2;l-f3;ad3f2;itr;ha;! 2;m8s2;un0;ay of the dead,ecemb3i2;a de muertos,eciseis de septiembre,wali;er sol2;stice;anad8h4inco de mayo,o3yber m2;on0;lumbu1mmonwealth 0rpus christi;anuk4inese n3ristmas2;! N;ew year;ah;a 0ian tha2;nksgiving;astillCeltaine,lack4ox2;in2;g 0; fri0;dvent,ll 9pril fools,rmistic8s6u2;stral4tum2;nal2; equinox;ia 0;cens2h wednes0sumption of mary;ion 0;e 0;hallows 6s2;ai2oul1t1;nt1;s 0;day;eve|Month\xA6aBdec9feb7j2mar,nov9oct1sep0;!t8;!o8;an3u0;l1n0;!e;!y;!u1;!ru0;ary;!em0;ber;pr1ug0;!ust;!il|Duration\xA6centur4d2hour3m0seconds,week3year3;i0onth2;llisecond1nute1;ay0ecade0;!s;ies,y|FirstName\xA6aEblair,cCdevBj8k6lashawn,m3nelly,re2sh0;ay,e0iloh;a,lby;g1ne;ar1el,org0;an;ion,lo;as8e0;ls7nyatta,rry;am0ess1;ie,m0;ie;an,on;as0heyenne;ey,sidy;lexis,ndra,ubr0;ey|LastName\xA60:35;1:3A;2:3C;3:2Z;4:2F;a3Bb31c2Od2Ee2Bf25g1Zh1Oi1Jj1Dk16l0Ym0Mn0Io0Fp04rXsLtGvEwBxAy7zh5;a5ou,u;ng,o;a5eun2Uoshi1Jun;ma5ng;da,guc1Zmo27sh21zaQ;iao,u;a6eb0il5o3right,u;li3Bs1;gn0lk0ng,tanabe;a5ivaldi;ssilj37zqu2;a8h7i2Go6r5sui,urn0;an,ynisI;lst0Orr1Uth;at1Uomps1;kah0Unaka,ylor;aDchCeBhimizu,iAmi9o8t6u5zabo;ar2lliv2AzuD;a5ein0;l23rm0;sa,u3;rn4th;lva,mmo24ngh;mjon4rrano;midt,neid0ulz;ito,n6sa5to;ki;ch2dKtos,z;amAeag1Zi8o6u5;bio,iz,sC;b5dri1MgHj0Sme24osevelt,sZux;erts,ins1;c5ve0E;ci,hards1;ir2os;aDe9h7ic5ow20;as5hl0;so;a5illips;m,n1T;ders20et7r6t5;e0Nr4;ez,ry;ers;h21rk0t5vl4;el,te0J;baAg0Alivei00r5;t5w1O;ega,iz;a5eils1guy1Rix1owak,ym1E;gy,ka5var1K;ji5muV;ma;aDeBiAo7u5;ll0n5rr0Bssolini,\xF15;oz;lina,oJr5zart;al0Me5r0U;au,no;hhail4ll0;rci0s5y0;si;eVmmad4r5tsu07;in5tin2;!o;aBe7i5op2uo;!n5u;coln,dholm;fe6n0Qr5w0J;oy;bv5v5;re;mmy,rs14u;aAennedy,imu9le0Lo7u6wo5;k,n;mar,znets4;bay5vacs;asY;ra;hn,rl8to,ur,zl4;a9en8ha3imen2o5u3;h5nYu3;an5ns1;ss1;ki0Es0S;cks1nsse0D;glesi8ke7noue,shik6to,vano5;u,v;awa;da;as;aBe8it7o6u5;!a3b0ghNynh;a3ffmann,rvat;chcock,l0;mingw6nde5rM;rs1;ay;ns0ErrPs6y5;asCes;an4hi5;moI;a8il,o7r6u5;o,tierr2;ayli3ub0;m2nzal2;nd5o,rcia;hi;er9is8lor7o6uj5;ita;st0urni0;es;ch0;nand2;d6insteGsposi5vaK;to;is1wards;aBeAi8omin7u5;bo5rand;is;gu2;az,mitr4;ov;lgado,vi;nkula,rw6vi5;es,s;in;aEhAlark9o5;hKl5op0rbyn,x;em6li5;ns;an;!e;an7e6iu,o5ristensFu3we;i,ng,u3w,y;!n,on5u3;!g;mpb6rt0st5;ro;ell;aAe7ha3lanco,oyko,r5yrne;ooks,yant;ng;ck6ethov5nnett;en;er,ham;ch,h7iley,rn5;es,i0;er;k,ng;dCl8nd5;ers5r9;en,on,s1;on;eks6iy7var2;ez;ej5;ev;ams|MaleName\xA60:CE;1:BK;2:C2;3:BS;4:B4;5:BZ;6:AT;7:9V;8:BC;9:AW;A:AO;B:8W;aB5bA9c98d88e7Hf6Zg6Hh5Wi5Ij4Lk4Bl3Rm2Pn2Eo28p22qu20r1As0Qt07u06v01wOxavi3yHzC;aCor0;cCh8Jne;hDkC;!a5Z;ar51e5Y;ass2i,oDuC;sEu25;nFsEusC;oCsD;uf;ef;at0g;aKeIiDoCyaAQ;lfgang,odrow;lCn1O;bEey,frBJlC;aA6iC;am,e,s;e8Aur;i,nde7sC;!l6t1;de,lDrr5yC;l1ne;lCt3;a94y;aFern1iC;cDha0nceCrg9Cva0;!nt;ente,t5B;lentin49n8Zughn;lyss4Msm0;aTeOhLiJoFrDyC;!l3ro8s1;av9ReCist0oy,um0;nt9Jv55y;bEd7YmCny;!as,mCoharu;aAYie,y;iBy;mCt9;!my,othy;adDeoCia7EomB;!do7O;!de9;dFrC;en8JrC;an8IeCy;ll,n8H;!dy;dgh,ic9Unn3req,ts46;aScotQeOhKiIoGpenc3tCur1Pylve8Jzym1;anEeCua7D;f0phAGvCwa7C;e59ie;!islaw,l6;lom1nA4uC;leyma8ta;dClBm1;!n6;aEeC;lCrm0;d1t1;h6Une,qu0Vun,wn,y8;aCbasti0k1Yl42rg41th,ymo9J;m9n;!tC;!ie,y;lDmCnti22q4Kul;!mAu4;ik,vato6X;aXeThe94iPoGuDyC;an,ou;b6NdDf9pe6SssC;!elAK;ol2Vy;an,bJcIdHel,geGh0landA4mFnEry,sDyC;!ce;coe,s;!a96nA;an,eo;l3Kr;e4Sg3n6oA5ri6A;co,ky;bAe9V;cCl6;ar5Qc5PhDkCo;!ey,ie,y;a87ie;gDid,ub5x,yCza;ansh,nT;g8XiC;na8Ts;ch60fa4lEmDndCpha4sh6Wul,ymo72;alA0ol2Cy;i9Jon;f,ph;ent2inC;cy,t1;aGeEhilDier64ol,reC;st1;!ip,lip;d9Crcy,tC;ar,e2W;b3Udra6Ht46ul;ctav2Wliv3m97rGsDtCum8Vw5;is,to;aDc8TvC;al54;ma;i,l4BvK;athKeIiEoC;aCel,l0ma0r2Y;h,m;cDg4i3KkC;h6Wola;holBkColB;!olB;al,d,il,ls1vC;il52;anCy;!a4i4;aXeUiLoGuDyC;l22r1;hamDr61staC;fa,p4I;ed,mG;dibo,e,hamEis1YntDsCussa;es,he;e,y;ad,ed,mC;ad,ed;cHgu4kFlEnDtchC;!e7;a7Aik;o04t1;e,olC;aj;ah,hCk6;a4eC;al,l;hDlv2rC;le,ri7v2;di,met;ck,hOlMmPnu4rIs1tEuricDxC;!imilian87we7;e,io;eo,hDiBtC;!eo,hew,ia;eCis;us,w;cEio,k81lDqu6Isha7tCv2;i2Jy;in,on;!el,oLus;achCcolm,ik;ai,y;amCdi,moud;adC;ou;aSeOiNlo2ToJuDyC;le,nd1;cFiEkCth3;aCe;!s;gi,s;as,iaC;no;g0nn6SrenEuCwe7;!iC;e,s;!zo;am,on4;a7Cevi,la4UnEoCst3vi;!nC;!a62el;!ny;mDnCr16ur4Vwr4V;ce,d1;ar,o4P;aJeEhaled,iCrist4Xu4Ay3D;er0p,rC;by,k,ollos;en0iFnCrmit,v2;!dDnCt5E;e10y;a7ri4P;r,th;na69rCthem;im,l;aZeRiPoEuC;an,liCst2;an,o,us;aqu2eKhnJnHrFsC;eDhCi7Due;!ua;!ph;dCge;an,i,on;!aCny;h,s,th4Z;!ath4Yie,nA;!l,sCy;ph;an,e,mC;!mA;d,ffHrEsC;sCus;!e;a5KemDmai8oCry;me,ni0Q;i6Wy;!e07rC;ey,y;cId5kHmGrEsDvi3yC;!d5s1;on,p3;ed,od,rCv4O;e51od;al,es,is1;e,ob,ub;k,ob,quC;es;aObrahNchika,gLkeKlija,nuJrHsEtCv0;ai,sC;uki;aCha0i6Hma4sac;ac,iaC;h,s;a,vinCw2;!g;k,nngu53;!r;nacCor;io;im;in,n;aLeGina4WoEuCyd57;be27gCmber4EsE;h,o;m3ra35sCwa3Z;se2;aFctEitEnDrC;be22m0;ry;or;th;bLlKmza,nJo,rEsDyC;a44d5;an,s0;lFo4FrEuCv6;hi41ki,tC;a,o;is1y;an,ey;k,s;!im;ib;aReNiMlenLoJrFuC;illerDsC;!tavo;mo;aEegCov3;!g,orC;io,y;dy,h58nt;nzaCrd1;lo;!n;lbe4Qno,ovan4S;ne,oErC;aCry;ld,rd4O;ffr6rge;bri4l5rCv2;la20r3Fth,y;aSeOiMlKorr0JrC;anEedCitz;!dAeCri25;ri24;cEkC;!ie,lC;in,yn;esKisC;!co,zek;etch3oC;yd;d4lConn;ip;deriEliDng,rnC;an02;pe,x;co;bi0di;ar00dVfrUit0lOmHnGo2rDsteb0th0uge8vCym5zra;an,ere2W;gi,iDnCrol,v2w2;est3Zie;c08k;och,rique,zo;aHerGiDmC;aGe2Q;lDrC;!h0;!io;s1y;nu4;be0Ad1iFliEmDt1viCwood;n,s;er,o;ot1Us;!as,j44sC;ha;a2en;!dAg32mFuDwC;a26in;arC;do;o0Tu0T;l,nC;est;aZePiMoFrEuDwCyl0;ay8ight;a8dl6nc0st2;ag0ew;minGnEri0ugDyC;le;!lB;!a29nCov0;e7ie,y;go,icC;!k;armuDeCll1on,rk;go;id;anJj0lbeImetri9nGon,rFsEvDwCxt3;ay8ey;en,in;hawn,mo09;ek,ri0G;is,nCv3;is,y;rt;!dC;re;lLmJnIrEvC;e,iC;!d;en,iEne7rCyl;eCin,yl;l2Wn;n,o,us;!e,i4ny;iCon;an,en,on;e,lB;as;a07e05hXiar0lMoHrFuDyrC;il,us;rtC;!is;aCistobal;ig;dy,lFnDrC;ey,neli9y;or,rC;ad;by,e,in,l2t1;aHeEiCyJ;fCnt;fo0Dt1;meDt9velaC;nd;nt;rEuDyC;!t1;de;enC;ce;aGeFrisDuC;ck;!tC;i0oph3;st3;d,rlCs;eCie;s,y;cCdric,s11;il;lFmer1rC;ey,lDro7y;ll;!os,t1;eb,v2;ar03eVilUlaToQrDuCyr1;ddy,rtJ;aKeFiEuDyC;an,ce,on;ce,no;an,ce;nDtC;!t;dDtC;!on;an,on;dDndC;en,on;!foCl6y;rd;bDrCyd;is;!by;i8ke;al,lA;nGrCshoi;at,nDtC;!r11;aCie;rd0M;!edict,iDjam2nA;ie,y;to;n6rCt;eCy;tt;ey;ar0Yb0Od0Kgust2hm0Hid5ja0FlZmXnPputsiOrFsaEuCya0ziz;gust9st2;us;hi;aJchIi4jun,maGnEon,tCy0;hCu07;ur;av,oC;ld;an,nd05;el;ie;ta;aq;dHgel00tC;hoFoC;i8nC;!iXy;ne;ny;reCy;!as,s,w;ir,mCos;ar;an,bePd5eJfGi,lFonEphonIt1vC;aNin;on;so,zo;an,en;onDrC;edK;so;c,jaFksandEssaFxC;!and3;er;ar,er;ndC;ro;rtC;!o;ni;en;ad,eC;d,t;in;aDoCri0vik;lfo;mCn;!a;dGeFraDuC;!bakr,lfazl;hCm;am;!l;allFel,oulaye,ulC;!lDrahm0;an;ah,o;ah;av,on|Verb\xA6awak9born,cannot,fr8g7h5k3le2m1s0wors9;e8h3;ake sure,sg;ngth6ss6;eep tabs,n0;own;as0e2;!t2;iv1onna;ight0;en|PhrasalVerb\xA60:71;1:6P;2:7D;3:73;4:6I;5:7G;6:75;7:6O;8:6B;9:6C;A:5H;B:70;C:6Z;a7Gb62c5Cd59e57f45g3Nh37iron0j33k2Yl2Km2Bn29o27p1Pr1Es09tQuOvacuum 1wGyammerCzD;eroAip EonD;e0k0;by,up;aJeGhFiEorDrit52;d 1k2Q;mp0n49pe0r8s8;eel Bip 7K;aEiD;gh 06rd0;n Br 3C;it 5Jk8lk6rm 0Qsh 73t66v4O;rgeCsD;e 9herA;aRePhNiJoHrFuDype 0N;ckArn D;d2in,o3Fup;ade YiDot0y 32;ckle67p 79;ne66p Ds4C;d2o6Kup;ck FdEe Dgh5Sme0p o0Dre0;aw3ba4d2in,up;e5Jy 1;by,o6U;ink Drow 5U;ba4ov7up;aDe 4Hll4N;m 1r W;ckCke Elk D;ov7u4N;aDba4d2in,o30up;ba4ft7p4Sw3;a0Gc0Fe09h05i02lYmXnWoVpSquare RtJuHwD;earFiD;ngEtch D;aw3ba4o6O; by;ck Dit 1m 1ss0;in,up;aIe0RiHoFrD;aigh1LiD;ke 5Xn2X;p Drm1O;by,in,o6A;n2Yr 1tc3H;c2Xmp0nd Dr6Gve6y 1;ba4d2up;d2o66up;ar2Uell0ill4TlErDurC;ingCuc8;a32it 3T;be4Brt0;ap 4Dow B;ash 4Yoke0;eep EiDow 9;c3Mp 1;in,oD;ff,v7;gn Eng2Yt Dz8;d2o5up;in,o5up;aFoDu4E;ot Dut0w 5W;aw3ba4f36o5Q;c2EdeAk4Rve6;e Hll0nd GtD; Dtl42;d2in,o5upD;!on;aw3ba4d2in,o1Xup;o5to;al4Kout0rap4K;il6v8;at0eKiJoGuD;b 4Dle0n Dstl8;aDba4d2in52o3Ft2Zu3D;c1Ww3;ot EuD;g2Jnd6;a1Wf2Qo5;ng 4Np6;aDel6inAnt0;c4Xd D;o2Su0C;aQePiOlMoKrHsyc29uD;ll Ft D;aDba4d2in,o1Gt33up;p38w3;ap37d2in,o5t31up;attleCess EiGoD;p 1;ah1Gon;iDp 52re3Lur44wer 52;nt0;ay3YuD;gAmp 9;ck 52g0leCn 9p3V;el 46ncilA;c3Oir 2Hn0ss FtEy D;ba4o4Q; d2c1X;aw3ba4o11;pDw3J;e3It B;arrow3Serd0oD;d6te3R;aJeHiGoEuD;ddl8ll36;c16p 1uth6ve D;al3Ad2in,o5up;ss0x 1;asur8lt 9ss D;a19up;ke Dn 9r2Zs1Kx0;do,o3Xup;aOeMiHoDuck0;a16c36g 0AoDse0;k Dse34;aft7ba4d2forw2Ain3Vov7uD;nd7p;e GghtFnEsDv1T;ten 4D;e 1k 1; 1e2Y;ar43d2;av1Ht 2YvelD; o3L;p 1sh DtchCugh6y1U;in3Lo5;eEick6nock D;d2o3H;eDyA;l2Hp D;aw3ba4d2fSin,o05to,up;aFoEuD;ic8mpA;ke2St2W;c31zz 1;aPeKiHoEuD;nker2Ts0U;lDneArse2O;d De 1;ba4d2oZup;de Et D;ba4on,up;aw3o5;aDlp0;d Fr Dt 1;fDof;rom;in,oO;cZm 1nDve it;d Dg 27kerF;d2in,o5;aReLive Jloss1VoFrEunD; f0M;in39ow 23; Dof 0U;aEb17it,oDr35t0Ou12;ff,n,v7;bo5ft7hJw3;aw3ba4d2in,oDup,w3;ff,n,ut;a17ek0t D;aEb11d2oDr2Zup;ff,n,ut,v7;cEhDl1Pr2Xt,w3;ead;ross;d aEnD;g 1;bo5;a08e01iRlNoJrFuD;cDel 1;k 1;eEighten DownCy 1;aw3o2L;eDshe1G; 1z8;lFol D;aDwi19;bo5r2I;d 9;aEeDip0;sh0;g 9ke0mDrD;e 2K;gLlJnHrFsEzzD;le0;h 2H;e Dm 1;aw3ba4up;d0isD;h 1;e Dl 11;aw3fI;ht ba4ure0;eInEsD;s 1;cFd D;fDo1X;or;e B;dQl 1;cHll Drm0t0O;apYbFd2in,oEtD;hrough;ff,ut,v7;a4ehi1S;e E;at0dge0nd Dy8;o1Mup;o09rD;ess 9op D;aw3bNin,o15;aShPlean 9oDross But 0T;me FoEuntD; o1M;k 1l6;aJbIforGin,oFtEuD;nd7;ogeth7;ut,v7;th,wD;ard;a4y;pDr19w3;art;eDipA;ck BeD;r 1;lJncel0rGsFtch EveA; in;o16up;h Bt6;ry EvD;e V;aw3o12;l Dm02;aDba4d2o10up;r0Vw3;a0He08l01oSrHuD;bbleFcklTilZlEndlTrn 05tDy 10zz6;t B;k 9; ov7;anMeaKiDush6;ghHng D;aEba4d2forDin,o5up;th;bo5lDr0Lw3;ong;teD;n 1;k D;d2in,o5up;ch0;arKgJil 9n8oGssFttlEunce Dx B;aw3ba4;e 9; ar0B;k Bt 1;e 1;d2up; d2;d 1;aIeed0oDurt0;cFw D;aw3ba4d2o5up;ck;k D;in,oK;ck0nk0st6; oJaGef 1nd D;d2ov7up;er;up;r0t D;d2in,oDup;ff,ut;ff,nD;to;ck Jil0nFrgEsD;h B;ainCe B;g BkC; on;in,o5; o5;aw3d2o5up;ay;cMdIsk Fuction6; oD;ff;arDo5;ouD;nd;d D;d2oDup;ff,n;own;t D;o5up;ut|Modal\xA6c5lets,m4ought3sh1w0;ill,o5;a0o4;ll,nt;! to;ay,ight,ust;an,o0;uld|Adjective\xA60:74;1:7J;2:7P;3:7I;4:7B;5:5B;6:4R;7:48;8:49;9:60;A:7G;B:5W;C:72;D:6Z;a6Hb63c5Pd55e4Rf48g3Zh3Oi33j31k30l2Pm2En25o1Pp19quack,r0Zs0Ft08uPvMwEyear5;arp0eIholeHiGoE;man5oEu6A;d6Czy;despr73s5E;!sa8;eFlEste24;co1Gl o4J;!k5;aFiEola4A;b7Rce versa,ol53;ca2gabo61nilla;ltVnIpFrb58su4tterE;!mo6Y; f32b1MpFsEti1F;ca8et,ide dLtairs;er,i3L;aObeco6Pconvin25deLeKfair,ivers4knJprecedXrHsFwE;iel1Yritt5X;i1TuE;pervis0specti3;eEu5;cognKgul6Fl6F;own;ndi3v5Rxpect0;cid0rE;!grou5MsE;iz0tood;b8ppeaKssu6EuthorE;iz0;i22ra;aIeGhough4NoFrE;i1oubl0;geth6p,rpD;en5OlEm4Yrr2Sst0;li3;boo,lEn;ent0;aWcVeThSiQmug,nobbi3DoOpNqueami3DtIuEymb62;bGi gener53pErprisi3;erEre0J;! dup6b,i27;du0seq4S;anda6SeHi0NrEy37;aightEip0; fEfE;or59;adfa60reotyp0;aBec2Eir1HlendDot on; call0le,mb6phist1VrEu0Vvi40;dDry;gnifica2nE;ceBg8;am2Oe6ocki3ut;cEda1em5lfi2Xni1Upa67re7;o1Er3U;at56ient26reec56;cr0me,ns serif;aLeHiFoE;bu5Ott4SuRy4;ghtEv4;!-27f9;ar,bel,condi1du61fres50lGpublic3UsEta2C;is46oE;lu1na2;e1Cuc44;bDciE;al,st;aOeMicayu7lacDopuli5FrFuE;bl58mp0;eIiFoE;!b08fuCmi30p6;mFor,sEva1;ti7;a4Ue;ciCmE;a0Gi5I;ac20rEti1;feAma2Tplexi3v33;rEst;allelGtE;-tiEi4;me;!ed;bPffNkMld fashion0nLpKrg1Gth6utJvE;al,erE;!aGniFt,wE;eiErouE;ght;ll;do0Uer,g2Lsi45;en,posi1; boa5Fg2Jli7;!ay; gua5DbEli7;eat;eGsE;cEer0Gole1;e7uB;d2Sse;ak0eLiKoEua4O;nIrFtE;ab8;thE;!eE;rn;chala2descri4Zstop;ght5;arby,cessa3Wighbor5xt;aMeKiHoEultip8;bi8derFlEnth5ot,st;dy;a1n;nEx0;iaEor;tuB;di4EnaEre;ci3;cEgenta,in,j02keshift,le,mmoth,ny,sculi7;abBho;aNeIiFoEu13;uti12vi3;mFteraE;l,te;it0;ftHgEth4;al,eFitiE;ma1;nda3C;!-0B;nguDst,tt6;ap1Sind5no09;agg0uE;niNstifi0veni8;de4gno4Blleg4mRnGpso 1VrE;a1releE;va2; MaLbr0corKdIfluenSiSnHsGtE;aAenCoxE;ic36;a7i2R;a1er,oce2;iFoE;or;reA;deq3Jppr2Y;fEsitu,vitro;ro2;mIpE;arGerfeAoErop6;li1rtE;a2ed;ti4;eEi0Q;d2QnC;aJelIiGoEumdr3B;ne2Zok0rrEs07ur5;if2S;ghfalut1OspE;an2Q;liZpf9;lHnGrE;d05roE;wi3;dy,gi3;f,low0;ainf9ener2Jiga22lLoKraHuE;aFilEng ho;ty;rd0;cFtE;ef9is;ef9;ne,od;ea2Cob4;aTeNinMlLoGrE;a1SeEoz1J;e2Cq11tf9;oGrE; keeps,eEm6tuna1;g03ign;liE;sh;ag2Yue2;al,i1;dImFrE;ti8;a8ini7;ne;le; up;bl0i2lCr Eux,vori1;oEreac1E;ff;aNfficie2lMmiLnJreAthere4veIxE;aAcess,peGtraFuE;be2Ll0H;!va1D;ct0rt;n,ryday; Ecouragi3tiB;rou1sui1;ne2;abo22dPe17i1;g6sE;t,ygE;oi3;er;aUeMiGoErea14ue;mina2ne,ubE;le,tf9;dact1Afficu1NsFvE;erC;creGeas0gruntl0hone1EordFtE;a2ress0;er5;et; KadpJfIgene1OliGrang0spe1OtFvoE;ut;ail0ermin0;be1Lca1ghE;tf9;ia2;an;facto;i5magEngeroYs0H;ed,i3;ly;ertaQhief,ivil,oGrE;aEowd0u0G;mp0v01z0;loMmKnFoi3rrEve0O;eAu1H;cre1grHsGtE;emEra0E;po0C;ta2;ue2;mer07pleE;te,x;ni4ss4;in;aOeKizarBlIoFrE;and new,isk,okO;gFna fiVttom,urgeoE;is;us;ank,iH;re;autif9hiFlov0nEst,yoF;eUt;nd;ul;ckFnkru0WrrE;en;!wards; priori,b0Mc0Jd09fraDg04h03lYma05ntiquXpTrNsLttracti06utheKvHwE;aFkE;wa0T;ke,re;ant garFerE;age;de;ntU;leep,tonisE;hi3;ab,bitHroGtiE;fiE;ci4;ga2;raE;ry;pEt;are2etiOrE;oprE;ia1;at0;arHcohFeEiLl,oof;rt;olE;ic;mi3;ead;ainGgressiFoniE;zi3;ve;st;id; LeJuIvE;aFerC;se;nc0;ed;lt;pt,qE;ua1;hoc,infinitE;um;cuFtu4u1;al;ra1;erOlNoLruKsFuE;nda2;e2oFtraA;ct;lu1rbi3;ng;te;pt;aEve;rd;aze,e;ra2;nt|Comparable\xA60:41;1:4I;2:45;3:4B;4:2Y;5:3X;a4Ob44c3Od3De35f2Rg2Fh24i1Vj1Uk1Rl1Im1Cn16o14p0Tqu0Rr0IsRtKuIvFw7y6za12;ell27ou3;aBe9hi1Yi7r6;o3y;ck0Mde,l6n1ry,se;d,y;a6i4Mt;k,ry;n1Tr6sI;m,y;a7e6ulgar;nge5rda2xi3;gue,in,st;g0n6pco3Mse5;like0ti1;aAen9hi8i7ough,r6;anqu2Qen1ue;dy,g3Ume0ny,r09;ck,n,rs2R;d42se;ll,me,rt,s6wd47;te5;aVcarUeThRiQkin0GlMmKoHpGqua1HtAu7w6;eet,ift;b7dd15per0Hr6;e,re2J;sta2Ht4;aAe9iff,r7u6;pXr1;a6ict,o3;ig3Hn0W;a1ep,rn;le,rk;e24i3Hright0;ci2Aft,l7o6re,ur;n,thi3;emn,id;a6el0ooth;ll,rt;e8i6ow,y;ck,g37m6;!y;ek,nd3F;ck,l0mp4;a6iUort,rill,y;dy,ll0Zrp;cu0Tve0Txy;ce,ed,y;d,fe,int0l1Xv16;aBe9i8o6ude;mantic,o1Ksy,u6;gh,nd;ch,pe,tzy;a6d,mo0J;dy,l;gg7ndom,p6re,w;id;ed;ai2i6;ck,et;aFhoEi1SlCoBr8u6;ny,r6;e,p4;egna2ic7o6;fou00ud;ey,k0;li06or,te1D;a6easa2;in,nt;ny;in5le;dd,f6i0ld,ranR;fi11;aAe8i7o6;b4isy,rm16sy;ce,mb4;a6w;r,t;ive,rr02;aAe8ild,o7u6;nda1Ate;ist,o1;a6ek,llY;n,s0ty;d,tuR;aCeBi9o6ucky;f0Vn7o1Eu6ve0w18y0U;d,sy;e0g;g1Uke0tt4v6;e0i3;an,wd;me,r6te;ge;e7i6;nd;en;ol0ui1P;cy,ll,n6;sBt6;e6ima8;llege2r6;es7media6;te;ti3;ecu6ta2;re;aEeBiAo8u6;ge,m6ng1R;b4id;ll6me0t;ow;gh,l0;a6f04sita2;dy,v6;en0y;nd1Hppy,r6te5;d,sh;aGenFhDiClBoofy,r6;a9e8is0o6ue1E;o6ss;vy;at,en,y;nd,y;ad,ib,ooI;a2d1;a6o6;st0;t4uiY;u1y;aIeeb4iDlat,oAr8u6;ll,n6r14;!ny;aHe6iend0;e,sh;a7r6ul;get5mG;my;erce8n6rm,t;an6e;ciC;! ;le;ir,ke,n0Fr,st,t,ulA;aAerie,mp9sse7v6xtre0Q;il;nti6;al;ty;r7s6;tern,y;ly,th0;aFeCi9r7u6;ll,mb;u6y;nk;r7vi6;ne;e,ty;a6ep,nD;d6f,r;!ly;mp,pp03rk;aHhDlAo8r7u6;dd0r0te;isp,uel;ar6ld,mmon,ol,st0ward0zy;se;e6ou1;a6vW;n,r;ar8e6il0;ap,e6;sy;mi3;gey,lm8r6;e5i3;ful;!i3;aNiLlIoEr8u6;r0sy;ly;aAi7o6;ad,wn;ef,g7llia2;nt;ht;sh,ve;ld,r7un6;cy;ed,i3;ng;a7o6ue;nd,o1;ck,nd;g,tt6;er;d,ld,w1;dy;bsu9ng8we6;so6;me;ry;rd|Adverb\xA6a07by 05d01eYfShQinPjustOkinda,mMnJoEpCquite,r9s5t2up1very,w0Bye0;p,s; to,wards5;h1o0wiO;o,t6ward;en,us;everal,o0uch;!me1rt0; of;hXtimes,w07;a1e0;alS;ndomRthN;ar excellDer0oint blank; Mhaps;f3n0;ce0ly;! 0;ag00moU; courHten;ewJo0; longEt 0;onHwithstanding;aybe,eanwhiAore0;!ovB;! aboS;deed,steT;en0;ce;or2u0;l9rther0;!moH; 0ev3;examp0good,suF;le;n mas1v0;er;se;e0irect1; 1finite0;ly;ju7trop;far,n0;ow; CbroBd nauseam,gAl5ny2part,side,t 0w3;be5l0mo5wor5;arge,ea4;mo1w0;ay;re;l 1mo0one,ready,so,ways;st;b1t0;hat;ut;ain;ad;lot,posteriori|Expression\xA6a02b01dXeVfuck,gShLlImHnGoDpBshAu7voi04w3y0;a1eLu0;ck,p;!a,hoo,y;h1ow,t0;af,f;e0oa;e,w;gh,h0;! 0h,m;huh,oh;eesh,hh,it;ff,hew,l0sst;ease,z;h1o0w,y;h,o,ps;!h;ah,ope;eh,mm;m1ol0;!s;ao,fao;a4e2i,mm,oly1urr0;ah;! mo6;e,ll0y;!o;ha0i;!ha;ah,ee,o0rr;l0odbye;ly;e0h,t cetera,ww;k,p;'oh,a0uh;m0ng;mit,n0;!it;ah,oo,ye; 1h0rgh;!em;la|Preposition\xA6'o,-,aKbHcGdFexcept,fEinDmidPnotwithstandiQoBpRqua,sAt6u3vi2w0;/o,hereMith0;!in,oQ;a,s-a-vis;n1p0;!on;like,til;h0ill,owards;an,r0;ough0u;!oI;ans,ince,o that;',f0n1ut;!f;!to;or,rom;espite,own,u3;hez,irca;ar1e0oAy;low,sides,tween;ri6;',bo7cross,ft6lo5m3propos,round,s1t0;!op;! long 0;as;id0ong0;!st;ng;er;ut|Conjunction\xA6aEbAcuz,how8in caDno7o6p4supposing,t1vers5wh0yet;eth8ile;h0o;eref9o0;!uC;l0rovided that;us;r,therwi6; matt1r;!ev0;er;e0ut;cau1f0;ore;se;lthou1nd,s 0;far as,if;gh|Determiner\xA6aAboth,d8e5few,l3mu7neiCown,plenty,some,th2various,wh0;at0ich0;evB;at,e3is,ose;a,e0;!ast,s;a1i6l0nough,very;!se;ch;e0u;!s;!n0;!o0y;th0;er\",\"conjugations\":\"t:ake,ook|:can,could,can,_|free:_,,,ing|puk:e,,,ing|ar:ise,ose,,,isen|babys:it,at|:be,was,is,am,been|:is,was,is,being|beat:_,,,ing,en|beg:in,an,,inning,un|ban:_,ned,,ning|bet:_,,,,_|bit:e,_,,ing,ten|ble:ed,d,,,d|bre:ed,d|br:ing,ought,,,ought|broadcast:_,_|buil:d,t,,,t|b:uy,ought,,,ought|cho:ose,se,,osing,sen|cost:_,_|deal:_,t,,,t|d:ie,ied,,ying|d:ig,ug,,igging,ug|dr:aw,ew,,,awn|dr:ink,ank,,,unk|dr:ive,ove,,iving,iven|:eat,ate,,eating,eaten|f:all,ell,,,allen|fe:ed,d,,,d|fe:el,lt|f:ight,ought,,,ought|f:ind,ound|fl:y,ew,,,own|bl:ow,ew,,,own|forb:id,ade|edit:_,,,ing|forg:et,ot,,eting,otten|forg:ive,ave,,iving,iven|fr:eeze,oze,,eezing,ozen|g:et,ot|g:ive,ave,,iving,iven|:go,went,goes,,gone|h:ang,ung,,,ung|ha:ve,d,s,ving,d|hear:_,d,,,d|hid:e,_,,,den|h:old,eld,,,eld|hurt:_,_,,,_|la:y,id,,,id|le:ad,d,,,d|le:ave,ft,,,ft|l:ie,ay,,ying|li:ght,t,,,t|los:e,t,,ing|ma:ke,de,,,de|mean:_,t,,,t|me:et,t,,eting,t|pa:y,id,,,id|read:_,_,,,_|r:ing,ang,,,ung|r:ise,ose,,ising,isen|r:un,an,,unning,un|sa:y,id,ys,,id|s:ee,aw,,eeing,een|s:ell,old,,,old|sh:ine,one,,,one|sho:ot,t,,,t|show:_,ed|s:ing,ang,,,ung|s:ink,ank|s:it,at|slid:e,_,,,_|sp:eak,oke,,,oken|sp:in,un,,inning,un|st:and,ood|st:eal,ole|st:ick,uck|st:ing,ung|:stream,,,,|str:ike,uck,,iking|sw:ear,ore|sw:im,am,,imming|sw:ing,ung|t:each,aught,eaches|t:ear,ore|t:ell,old|th:ink,ought|underst:and,ood|w:ake,oke|w:ear,ore|w:in,on,,inning|withdr:aw,ew|wr:ite,ote,,iting,itten|t:ie,ied,,ying|ski:_,ied|:boil,,,,|miss:_,,_|:act,,,,|compet:e,ed,,ing|:being,were,are,are|impl:y,ied,ies|ic:e,ed,,ing|develop:_,ed,,ing|wait:_,ed,,ing|aim:_,ed,,ing|spil:l,t,,,led|drop:_,ped,,ping|log:_,ged,,ging|rub:_,bed,,bing|smash:_,,es|egg:_,ed|suit:_,ed,,ing|age:_,d,s,ing|shed:_,_,s,ding|br:eak,oke|ca:tch,ught|d:o,id,oes|b:ind,ound|spread:_,_|become:_,,,,_|ben:d,,,,t|br:ake,,,,oken|burn:_,,,,ed|burst:_,,,,_|cl:ing,,,,ung|c:ome,ame,,,ome|cre:ep,,,,pt|cut:_,,,,_|dive:_,,,,d|dream:_,,,,t|fle:e,,,eing,d|fl:ing,,,,ung|got:_,,,,ten|grow:_,,,,n|hit:_,,,,_|ke:ep,,,,pt|kne:el,,,,lt|know:_,,,,n|leap:_,,,,t|len:d,,,,t|lo:ose,,,,st|prove:_,,,,n|put:_,,,,_|quit:_,,,,_|rid:e,,,,den|s:eek,,,,ought|sen:d,,,,t|set:_,,,,_|sew:_,,,,n|shake:_,,,,n|shave:_,,,,d|shut:_,,,,_|s:eat,,,,at|sla:y,,,,in|sle:ep,,,,pt|sn:eak,,,,uck|spe:ed,,,,d|spen:d,,,,t|sp:it,,,,at|split:_,,,,_|spr:ing,,,,ung|st:ink,unk,,,unk|strew:_,,,,n|sw:are,,,,orn|swe:ep,,,,pt|thrive:_,,,,d|undergo:_,,,,ne|upset:_,,,,_|w:eave,,,,oven|we:ep,,,,pt|w:ind,,,,ound|wr:ing,,,,ung\",\"plurals\":\"addend|um|a,alga|e,alumna|e,alumn|us|i,appendi|x|ces,avocado|s,bacill|us|i,barracks|,beau|x,bus|es,cact|us|i,chateau|x,analys|is|es,diagnos|is|es,parenthes|is|es,prognos|is|es,synops|is|es,thes|is|es,child|ren,circus|es,clothes|,corp|us|ora,criteri|on|a,curricul|um|a,database|s,deer|,echo|es,embargo|es,epoch|s,f|oot|eet,gen|us|era,g|oose|eese,halo|s,hippopotam|us|i,ind|ex|ices,larva|e,lea|f|ves,librett|o|i,loa|f|ves,m|an|en,matri|x|ces,memorand|um|a,modul|us|i,mosquito|es,move|s,op|us|era,ov|um|a,ox|en,pe|rson|ople,phenomen|on|a,quiz|zes,radi|us|i,referend|um|a,rodeo|s,sex|es,shoe|s,sombrero|s,stomach|s,syllab|us|i,tableau|x,thie|f|ves,t|ooth|eeth,tornado|s,tuxedo|s,zero|s\",\"patterns\":{\"Person\":[\"master of #Noun\",\"captain of the #Noun\"]},\"regex\":{\"HashTag\":[\"^#[a-z]+\"],\"Gerund\":[\"^[a-z]+n['\u2019]$\"],\"PhoneNumber\":[\"^[0-9]{3}-[0-9]{4}$\",\"^[0-9]{3}[ -]?[0-9]{3}-[0-9]{4}$\"],\"Time\":[\"^[012]?[0-9](:[0-5][0-9])(:[0-5][0-9])$\",\"^[012]?[0-9](:[0-5][0-9])?(:[0-5][0-9])? ?(am|pm)$\",\"^[012]?[0-9](:[0-5][0-9])(:[0-5][0-9])? ?(am|pm)?$\",\"^[PMCE]ST$\",\"^utc ?[+-]?[0-9]+?$\",\"^[a-z0-9]*? o'?clock$\"],\"Date\":[\"^[0-9]{1,4}-[0-9]{1,2}-[0-9]{1,4}$\",\"^[0-9]{1,4}/[0-9]{1,2}/[0-9]{1,4}$\"],\"Money\":[\"^[-+]?[$\u20AC\xA5\xA3][0-9]+(.[0-9]{1,2})?$\",\"^[-+]?[$\u20AC\xA5\xA3][0-9]{1,3}(,[0-9]{3})+(.[0-9]{1,2})?$\"],\"Value\":[\"^[-+]?[$\u20AC\xA5\xA3][0-9]+(.[0-9]{1,2})?$\",\"^[-+]?[$\u20AC\xA5\xA3][0-9]{1,3}(,[0-9]{3})+(.[0-9]{1,2})?$\",\"^[0-9.]{1,2}[-\u2013][0-9]{1,2}$\"],\"NumberRange\":[\"^[0-9.]{1,4}(st|nd|rd|th)?[-\u2013][0-9.]{1,4}(st|nd|rd|th)?$\",\"^[0-9.]{1,2}[-\u2013][0-9]{1,2}$\"],\"NiceNumber\":[\"^[-+]?[0-9.,]{1,3}(,[0-9.,]{3})+(.[0-9]+)?$\"],\"NumericValue\":[\"^[-+]?[0-9]+(.[0-9]+)?$\",\"^.?[0-9]+([0-9,.]+)?%$\"],\"Percent\":[\"^.?[0-9]+([0-9,.]+)?%$\"],\"Cardinal\":[\"^.?[0-9]+([0-9,.]+)?%$\"],\"Fraction\":[\"^[0-9]{1,4}/[0-9]{1,4}$\"],\"LastName\":[\"^ma?c'.*\",\"^o'[drlkn].*\"]}}";

},{}],209:[function(_dereq_,module,exports){
'use strict';

var conjugate = _dereq_('../subset/verbs/methods/conjugate/faster.js');

//extend our current irregular conjugations, overwrite if exists
//also, map the irregulars for easy infinitive lookup - {bought: 'buy'}
var addConjugations = function addConjugations(obj) {
  var _this = this;

  Object.keys(obj).forEach(function (inf) {
    _this.conjugations[inf] = _this.conjugations[inf] || {};
    //add it to the lexicon
    _this.words[inf] = _this.words[inf] || 'Infinitive';
    Object.keys(obj[inf]).forEach(function (tag) {
      var word = obj[inf][tag];
      //add this to our conjugations
      _this.conjugations[inf][tag] = word;
      //add it to the lexicon, too
      _this.words[word] = _this.words[word] || tag;
      //also denormalize to cache.toInfinitive
      _this.cache.toInfinitive[obj[inf][tag]] = inf;
    });
    //guess the other conjugations
    var forms = conjugate(inf, _this);
    Object.keys(forms).forEach(function (k) {
      var word = forms[k];
      if (_this.words.hasOwnProperty(word) === false) {
        _this.words[word] = k;
      }
    });
  });
  return obj;
};
module.exports = addConjugations;

},{"../subset/verbs/methods/conjugate/faster.js":79}],210:[function(_dereq_,module,exports){
"use strict";

//
var addPatterns = function addPatterns(obj) {
  var _this = this;

  Object.keys(obj).forEach(function (k) {
    _this.patterns[k] = obj[k];
  });
  return obj;
};
module.exports = addPatterns;

},{}],211:[function(_dereq_,module,exports){
'use strict';
//put singular->plurals in world, the reverse in cache,
//and both forms in the lexicon

var addPlurals = function addPlurals(obj) {
  var _this = this;

  Object.keys(obj).forEach(function (sing) {
    var plur = obj[sing];
    _this.plurals[sing] = plur;
    //add them both to the lexicon
    _this.words[plur] = _this.words[plur] || 'Plural';
    _this.words[sing] = _this.words[sing] || 'Singular';
    //denormalize them in cache.toPlural
    _this.cache.toSingular[plur] = sing;
  });
  return obj;
};
module.exports = addPlurals;

},{}],212:[function(_dereq_,module,exports){
'use strict';

//
var addRegex = function addRegex(obj) {
  var _this = this;

  Object.keys(obj).forEach(function (k) {
    _this.regex.push({
      reg: new RegExp(k, 'i'),
      tag: obj[k]
    });
  });
};
module.exports = addRegex;

},{}],213:[function(_dereq_,module,exports){
'use strict';
//add 'downward' tags (that immediately depend on this one)

var addDownword = _dereq_('../tags/addDownward');

//extend our known tagset with these new ones
var addTags = function addTags(tags) {
  var _this = this;

  Object.keys(tags).forEach(function (tag) {
    var obj = tags[tag];
    obj.notA = obj.notA || [];
    obj.downward = obj.downward || [];
    _this.tags[tag] = obj;
  });
  addDownword(this.tags);
  return tags;
};
module.exports = addTags;

},{"../tags/addDownward":135}],214:[function(_dereq_,module,exports){
'use strict';

var normalize = _dereq_('../term/methods/normalize/normalize').normalize;
var inflect = _dereq_('../subset/nouns/methods/pluralize');
var conjugate = _dereq_('../subset/verbs/methods/conjugate/faster.js');
var adjFns = _dereq_('../subset/adjectives/methods');
var wordReg = / /;

var cleanUp = function cleanUp(str) {
  str = normalize(str);
  //extra whitespace
  str = str.replace(/\s+/, ' ');
  //remove sentence-punctuaion too
  str = str.replace(/[.\?,;\!]/g, '');
  return str;
};

//
var addWords = function addWords(words) {
  var _this = this;

  //go through each word
  Object.keys(words).forEach(function (word) {
    var tag = words[word];
    word = cleanUp(word);
    _this.words[word] = tag;
    //add it to multi-word cache,
    if (wordReg.test(word) === true) {
      var arr = word.split(wordReg);
      _this.cache.firstWords[arr[0]] = true;
    }

    //turn singulars into plurals
    if (tag === 'Singular') {
      var plural = inflect(word, {});
      if (plural && plural !== word) {
        _this.words[plural] = 'Plural';
      }
      return;
    }
    //turn infinitives into all conjugations
    if (tag === 'Infinitive') {
      var conj = conjugate(word, _this);
      Object.keys(conj).forEach(function (k) {
        _this.words[conj[k]] = k;
      });
      return;
    }
    //phrasals like 'pull out' get conjugated too
    if (tag === 'PhrasalVerb') {
      var _arr = word.split(/ /);
      var _conj = conjugate(_arr[0], _this);
      Object.keys(_conj).forEach(function (k) {
        var form = _conj[k] + ' ' + _arr[1];
        _this.words[form] = 'PhrasalVerb';
        //add it to cache, too
        _this.cache.firstWords[_conj[k]] = true;
      });
      return;
    }
    //turn some adjectives into superlatives
    if (tag === 'Comparable') {
      var comp = adjFns.toComparative(word);
      if (comp && word !== comp) {
        _this.words[comp] = 'Comparative';
      }
      var supr = adjFns.toSuperlative(word);
      if (supr && word !== supr) {
        _this.words[supr] = 'Superlative';
      }
    }
  });

  return words;
};
module.exports = addWords;

},{"../subset/adjectives/methods":11,"../subset/nouns/methods/pluralize":44,"../subset/verbs/methods/conjugate/faster.js":79,"../term/methods/normalize/normalize":149}],215:[function(_dereq_,module,exports){
'use strict';
// const addWords = require('./addWords');

var fns = _dereq_('../fns');
var data = _dereq_('./_data');
var moreData = _dereq_('./more-data');
var tags = _dereq_('../tags');
var unpack = _dereq_('./unpack');
var addTags = _dereq_('./addTags');
var addWords = _dereq_('./addWords');
var addRegex = _dereq_('./addRegex');
var addConjugations = _dereq_('./addConjugations');
var addPatterns = _dereq_('./addPatterns');
var addPlurals = _dereq_('./addPlurals');
var misc = _dereq_('./more-data/misc');

//lazier/faster object-merge
var extend = function extend(main, obj) {
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    main[keys[i]] = obj[keys[i]];
  }
  return main;
};

//class World
var World = function World() {
  this.words = {};
  this.tags = tags;
  this.regex = [];
  this.patterns = {};
  this.conjugations = {};
  this.plurals = {};
  //denormalized data for faster-lookups
  this.cache = {
    firstWords: {},
    toInfinitive: {},
    toSingular: {}
  };
};

World.prototype.addTags = addTags;
World.prototype.addWords = addWords;
World.prototype.addRegex = addRegex;
World.prototype.addConjugations = addConjugations;
World.prototype.addPlurals = addPlurals;
World.prototype.addPatterns = addPatterns;

//make a no-reference copy of all the data
World.prototype.clone = function () {
  var _this = this;

  var w2 = new World();
  ['words', 'firstWords', 'tagset', 'regex', 'patterns', 'conjugations', 'plurals'].forEach(function (k) {
    if (_this[k]) {
      w2[k] = fns.copy(_this[k]);
    }
  });
  return w2;
};

//add all the things, in all the places
World.prototype.plugin = function (obj) {
  //untangle compromise-plugin
  obj = unpack(obj);
  //add all-the-things to this world object
  //(order may matter)
  if (obj.tags) {
    this.addTags(obj.tags);
  }
  if (obj.regex) {
    this.addRegex(obj.regex);
  }
  if (obj.patterns) {
    this.addPatterns(obj.patterns);
  }
  if (obj.conjugations) {
    this.addConjugations(obj.conjugations);
  }
  if (obj.plurals) {
    this.addPlurals(obj.plurals);
  }
  if (obj.words) {
    this.addWords(obj.words);
  }
};

//export a default world
var w = new World();
w.plugin(data);
w.addWords(misc);
moreData.forEach(function (obj) {
  extend(w.words, obj);
});

module.exports = {
  w: w,
  reBuild: function reBuild() {
    //export a default world
    var w2 = new World();
    w2.plugin(data);
    w2.addWords(misc);
    moreData.forEach(function (obj) {
      extend(w2.words, obj);
    });
    return w2;
  }
};

},{"../fns":3,"../tags":137,"./_data":208,"./addConjugations":209,"./addPatterns":210,"./addPlurals":211,"./addRegex":212,"./addTags":213,"./addWords":214,"./more-data":217,"./more-data/misc":219,"./unpack":223}],216:[function(_dereq_,module,exports){
//these are common word shortenings used in the lexicon and sentence segmentation methods
//there are all nouns,or at the least, belong beside one.
"use strict";

//common abbreviations

var compact = {
  Noun: ["arc", "al", "exp", "fy", "pd", "pl", "plz", "tce", "bl", "ma", "ba", "lit", "ex", "eg", "ie", "ca", "cca", "vs", "etc", "esp", "ft",
  //these are too ambiguous
  "bc", "ad", "md", "corp", "col"],
  Organization: ["dept", "univ", "assn", "bros", "inc", "ltd", "co",
  //proper nouns with exclamation marks
  "yahoo", "joomla", "jeopardy"],

  Place: ["rd", "st", "dist", "mt", "ave", "blvd", "cl", "ct", "cres", "hwy",
  //states
  "ariz", "cal", "calif", "colo", "conn", "fla", "fl", "ga", "ida", "ia", "kan", "kans", "minn", "neb", "nebr", "okla", "penna", "penn", "pa", "dak", "tenn", "tex", "ut", "vt", "va", "wis", "wisc", "wy", "wyo", "usafa", "alta", "ont", "que", "sask"],

  Month: ["jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec"],
  Date: ["circa"],

  //Honorifics
  Honorific: ["adj", "adm", "adv", "asst", "atty", "bldg", "brig", "capt", "cmdr", "comdr", "cpl", "det", "dr", "esq", "gen", "gov", "hon", "jr", "llb", "lt", "maj", "messrs", "mister", "mlle", "mme", "mr", "mrs", "ms", "mstr", "op", "ord", "phd", "prof", "pvt", "rep", "reps", "res", "rev", "sen", "sens", "sfc", "sgt", "sir", "sr", "supt", "surg"
  //miss
  //misses
  ],
  Value: ["no"]
};

//unpack the compact terms into the misc lexicon..
var abbreviations = {};
var keys = Object.keys(compact);
for (var i = 0; i < keys.length; i++) {
  var arr = compact[keys[i]];
  for (var i2 = 0; i2 < arr.length; i2++) {
    abbreviations[arr[i2]] = [keys[i], "Abbreviation"];
  }
}
module.exports = abbreviations;

},{}],217:[function(_dereq_,module,exports){
'use strict';

module.exports = [_dereq_('./abbreviations'), _dereq_('./irregularAdjectives').lexicon, _dereq_('./numbers').lexicon, _dereq_('./orgWords')];

},{"./abbreviations":216,"./irregularAdjectives":218,"./numbers":220,"./orgWords":221}],218:[function(_dereq_,module,exports){
'use strict';
//adjectives that have irregular conjugations to adverb, comparative, and superlative forms

var toAdverb = {
  bad: 'badly',
  best: 'best',
  early: 'early',
  fast: 'fast',
  good: 'well',
  hard: 'hard',
  icy: 'icily',
  idle: 'idly',
  late: 'late',
  latter: 'latter',
  little: 'little',
  long: 'long',
  low: 'low',
  male: 'manly',
  public: 'publicly',
  simple: 'simply',
  single: 'singly',
  special: 'especially',
  straight: 'straight',
  vague: 'vaguely',
  well: 'well',
  whole: 'wholly',
  wrong: 'wrong'
};

var toComparative = {
  grey: 'greyer',
  gray: 'grayer',
  green: 'greener',
  yellow: 'yellower',
  red: 'redder',
  good: 'better',
  well: 'better',
  bad: 'worse',
  sad: 'sadder',
  big: 'bigger'
};

var toSuperlative = {
  nice: 'nicest',
  late: 'latest',
  hard: 'hardest',
  inner: 'innermost',
  outer: 'outermost',
  far: 'furthest',
  worse: 'worst',
  bad: 'worst',
  good: 'best',
  big: 'biggest',
  large: 'largest'
};

var combine = function combine(lexicon, obj, tag) {
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    lexicon[keys[i]] = 'Comparable';
    if (lexicon[obj[keys[i]]] === undefined) {
      lexicon[obj[keys[i]]] = tag;
    }
  }
  return lexicon;
};
var lexicon = combine({}, toSuperlative, 'Superlative');
lexicon = combine(lexicon, toComparative, 'Comparative');
lexicon = combine(lexicon, toAdverb, 'Adverb');

module.exports = {
  lexicon: lexicon,
  toAdverb: toAdverb,
  toComparative: toComparative,
  toSuperlative: toSuperlative
};

},{}],219:[function(_dereq_,module,exports){
'use strict';

//words that can't be compressed, for whatever reason
module.exports = {
  '20th century fox': 'Organization',
  '3m': 'Organization',
  '7 eleven': 'Organization',
  '7-eleven': 'Organization',
  'g8': 'Organization',
  'motel 6': 'Organization',
  'vh1': 'Organization',
  'q1': 'Date',
  'q2': 'Date',
  'q3': 'Date',
  'q4': 'Date',
  //misc
  'records': 'Plural',
  '&': 'Conjunction'
};

},{}],220:[function(_dereq_,module,exports){
'use strict';

var cardinal = {
  ones: {
    // 'a': 1,
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9
  },
  teens: {
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19
  },
  tens: {
    twenty: 20,
    thirty: 30,
    forty: 40,
    fourty: 40, //support typo
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90
  },
  multiples: {
    hundred: 1e2,
    thousand: 1e3,
    // grand: 1e3,
    million: 1e6,
    billion: 1e9,
    trillion: 1e12,
    quadrillion: 1e15,
    quintillion: 1e18,
    sextillion: 1e21,
    septillion: 1e24
  }
};

var ordinal = {
  ones: {
    zeroth: 0,
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9
  },
  teens: {
    tenth: 10,
    eleventh: 11,
    twelfth: 12,
    thirteenth: 13,
    fourteenth: 14,
    fifteenth: 15,
    sixteenth: 16,
    seventeenth: 17,
    eighteenth: 18,
    nineteenth: 19
  },
  tens: {
    twentieth: 20,
    thirtieth: 30,
    fortieth: 40,
    fourtieth: 40, //support typo
    fiftieth: 50,
    sixtieth: 60,
    seventieth: 70,
    eightieth: 80,
    ninetieth: 90
  },
  multiples: {
    hundredth: 1e2,
    thousandth: 1e3,
    millionth: 1e6,
    billionth: 1e9,
    trillionth: 1e12,
    quadrillionth: 1e15,
    quintillionth: 1e18,
    sextillionth: 1e21,
    septillionth: 1e24
  }
};

//used for the units
var prefixes = {
  yotta: 1,
  zetta: 1,
  exa: 1,
  peta: 1,
  tera: 1,
  giga: 1,
  mega: 1,
  kilo: 1,
  hecto: 1,
  deka: 1,
  deci: 1,
  centi: 1,
  milli: 1,
  micro: 1,
  nano: 1,
  pico: 1,
  femto: 1,
  atto: 1,
  zepto: 1,
  yocto: 1,

  square: 1,
  cubic: 1,
  quartic: 1
};

//create an easy mapping between ordinal-cardinal
var toOrdinal = {};
var toCardinal = {};
var lexicon = {};
Object.keys(ordinal).forEach(function (k) {
  var ord = Object.keys(ordinal[k]);
  var card = Object.keys(cardinal[k]);
  for (var i = 0; i < card.length; i++) {
    toOrdinal[card[i]] = ord[i];
    toCardinal[ord[i]] = card[i];
    lexicon[ord[i]] = ['Ordinal', 'TextValue'];
    lexicon[card[i]] = ['Cardinal', 'TextValue'];
    if (k === 'multiples') {
      lexicon[ord[i]].push('Multiple');
      lexicon[card[i]].push('Multiple');
    }
  }
});

module.exports = {
  toOrdinal: toOrdinal,
  toCardinal: toCardinal,
  cardinal: cardinal,
  ordinal: ordinal,
  prefixes: prefixes,
  lexicon: lexicon
};

},{}],221:[function(_dereq_,module,exports){
'use strict';

//nouns that also signal the title of an unknown organization
//todo remove/normalize plural forms
var orgWords = ['administration', 'agence', 'agences', 'agencies', 'agency', 'airlines', 'airways', 'army', 'assoc', 'associates', 'association', 'assurance', 'authority', 'autorite', 'aviation', 'bank', 'banque', 'board', 'boys', 'brands', 'brewery', 'brotherhood', 'brothers', 'building society', 'bureau', 'cafe', 'caisse', 'capital', 'care', 'cathedral', 'center', 'central bank', 'centre', 'chemicals', 'choir', 'chronicle', 'church', 'circus', 'clinic', 'clinique', 'club', 'co', 'coalition', 'coffee', 'collective', 'college', 'commission', 'committee', 'communications', 'community', 'company', 'comprehensive', 'computers', 'confederation', 'conference', 'conseil', 'consulting', 'containers', 'corporation', 'corps', 'corp', 'council', 'crew', 'daily news', 'data', 'departement', 'department', 'department store', 'departments', 'design', 'development', 'directorate', 'division', 'drilling', 'education', 'eglise', 'electric', 'electricity', 'energy', 'ensemble', 'enterprise', 'enterprises', 'entertainment', 'estate', 'etat', 'evening news', 'faculty', 'federation', 'financial', 'fm', 'foundation', 'fund', 'gas', 'gazette', 'girls', 'government', 'group', 'guild', 'health authority', 'herald', 'holdings', 'hospital', 'hotel', 'hotels', 'inc', 'industries', 'institut', 'institute', 'institute of technology', 'institutes', 'insurance', 'international', 'interstate', 'investment', 'investments', 'investors', 'journal', 'laboratory', 'labs',
// 'law',
'liberation army', 'limited', 'local authority', 'local health authority', 'machines', 'magazine', 'management', 'marine', 'marketing', 'markets', 'media', 'memorial', 'mercantile exchange', 'ministere', 'ministry', 'military', 'mobile', 'motor', 'motors', 'musee', 'museum',
// 'network',
'news', 'news service', 'observatory', 'office', 'oil', 'optical', 'orchestra', 'organization', 'partners', 'partnership',
// 'party',
'people\'s party', 'petrol', 'petroleum', 'pharmacare', 'pharmaceutical', 'pharmaceuticals', 'pizza', 'plc', 'police', 'polytechnic', 'post', 'power', 'press', 'productions', 'quartet', 'radio', 'regional authority', 'regional health authority', 'reserve', 'resources', 'restaurant', 'restaurants', 'savings', 'school', 'securities', 'service', 'services', 'social club', 'societe', 'society', 'sons', 'standard', 'state police', 'state university', 'stock exchange', 'subcommittee', 'syndicat', 'systems', 'telecommunications', 'telegraph', 'television', 'times', 'tribunal', 'tv', 'union', 'university', 'utilities', 'workers'];

module.exports = orgWords.reduce(function (h, str) {
  h[str] = 'Noun';
  return h;
}, {});

},{}],222:[function(_dereq_,module,exports){
'use strict';
//supported verb forms:

var forms = [null, 'PastTense', 'PresentTense', 'Gerund', 'Participle'];
//
var unpackVerbs = function unpackVerbs(str) {
  var verbs = str.split('|');
  return verbs.reduce(function (h, s) {
    var parts = s.split(':');
    var prefix = parts[0];
    var ends = parts[1].split(',');
    //grab the infinitive
    var inf = prefix + ends[0];
    if (ends[0] === '_') {
      inf = prefix;
    }
    h[inf] = {};
    //we did the infinitive, now do the rest:
    for (var i = 1; i < forms.length; i++) {
      var word = parts[0] + ends[i];
      if (ends[i] === '_') {
        word = parts[0];
      }
      if (ends[i]) {
        h[inf][forms[i]] = word;
      }
    }
    return h;
  }, {});
};
module.exports = unpackVerbs;

},{}],223:[function(_dereq_,module,exports){
'use strict';

var unpack = {
  words: _dereq_('efrt-unpack'),
  plurals: _dereq_('./plurals'),
  conjugations: _dereq_('./conjugations'),
  keyValue: _dereq_('./key-value')
};
/*
 == supported plugin fields ==
  name
  words        - efrt packed
  tags         - stringified
  regex        - key-value
  patterns     - key-value
  plurals      - plural-unpack
  conjugations - conjugation-unpack
*/

var unpackPlugin = function unpackPlugin(str) {
  var obj = str;
  if (typeof str === 'string') {
    obj = JSON.parse(str);
  }
  //words is packed with efrt
  if (obj.words && typeof obj.words === 'string') {
    obj.words = unpack.words(obj.words);
  }
  //patterns is pivoted as key-value
  if (obj.patterns) {
    obj.patterns = unpack.keyValue(obj.patterns);
  }
  //regex, too
  if (obj.regex) {
    obj.regex = unpack.keyValue(obj.regex);
  }
  //plurals is packed in a ad-hoc way
  if (obj.plurals && typeof obj.plurals === 'string') {
    obj.plurals = unpack.plurals(obj.plurals);
  }
  //conjugations is packed in another ad-hoc way
  if (obj.conjugations && typeof obj.conjugations === 'string') {
    obj.conjugations = unpack.conjugations(obj.conjugations);
  }
  return obj;
};
module.exports = unpackPlugin;

},{"./conjugations":222,"./key-value":224,"./plurals":225,"efrt-unpack":1}],224:[function(_dereq_,module,exports){
'use strict';
//pivot k:[val,val] ->  val:k, val:k

var keyValue = function keyValue(obj) {
  var keys = Object.keys(obj);
  var isCompressed = true;
  if (keys[0] && typeof obj[keys[0]] === 'string') {
    isCompressed = false;
  }
  return keys.reduce(function (h, k) {
    if (isCompressed === true) {
      var arr = obj[k];
      arr.forEach(function (a) {
        if (h[a]) {
          //convert val to an array
          if (typeof h[a] === 'string') {
            h[a] = [h[a]];
          }
          //add it
          h[a].push(k);
        } else {
          h[a] = k;
        }
      });
    } else {
      h[k] = obj[k];
    }
    return h;
  }, {});
};
module.exports = keyValue;

},{}],225:[function(_dereq_,module,exports){
'use strict';

var unpackPlurals = function unpackPlurals(str) {
  return str.split(/,/g).reduce(function (h, s) {
    var arr = s.split(/\|/g);
    if (arr.length === 3) {
      h[arr[0] + arr[1]] = arr[0] + arr[2];
    } else if (arr.length === 2) {
      h[arr[0]] = arr[0] + arr[1];
    } else {
      h[arr[0]] = arr[0];
    }
    return h;
  }, {});
};
module.exports = unpackPlurals;

},{}]},{},[4])(4)
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],3:[function(require,module,exports){
var exec 	= require('child_process').exec;
var path 	= require('path');
var _ 		= require('underscore');

function ner(options) {
	this.options = _.extend({
		install_path:	'',
		jar:			'stanford-ner.jar',
		classifier:		'english.muc.7class.distsim.crf.ser.gz'
	}, options);
}

ner.prototype.fromFile = function(filename, callback) {
	var scope = this;
	var exec = require('child_process').exec;
	exec('java -mx1500m -cp '+path.normalize(this.options.install_path+'/'+this.options.jar)+' edu.stanford.nlp.ie.crf.CRFClassifier -loadClassifier '+path.normalize(this.options.install_path+'/classifiers/'+this.options.classifier)+' -textFile '+filename, function(error, stdout, stderr) {
		if (error) {
			console.log("ERROR:", error);
			return false;
		}
		scope.parse(stdout, callback);
	});
}

ner.prototype.parse = function(parsed, callback) {
	
	var tokenized 	= parsed.split(/\s/gmi);
	var splitRegex	= new RegExp('(.+)/([A-Z]+)','g');
	
	var tagged		= _.map(tokenized, function(token) {
		var parts = new RegExp('(.+)/([A-Z]+)','g').exec(token);
		if (parts) {
			return {
				w:	parts[1],
				t:	parts[2]
			}
		}
		return null;
	});
	
	tagged = _.compact(tagged);
	
	// Now we extract the neighbors into one entity
	var entities = {};
	var i;
	var l = tagged.length;
	var prevEntity 		= false;
	var entityBuffer	= [];
	for (i=0;i<l;i++) {
		if (tagged[i].t != 'O') {
			if (tagged[i].t != prevEntity) {
				// New tag!
				// Was there a buffer?
				if (entityBuffer.length>0) {
					// There was! We save the entity
					if (!entities.hasOwnProperty(prevEntity)) {
						entities[prevEntity] = [];
					}
					entities[prevEntity].push(entityBuffer.join(' '));
					// Now we set the buffer
					entityBuffer = [];
				}
				// Push to the buffer
				entityBuffer.push(tagged[i].w);
			} else {
				// Prev entity is same a current one. We push to the buffer.
				entityBuffer.push(tagged[i].w);
			}
		} else {
			if (entityBuffer.length>0) {
				// There was! We save the entity
				if (!entities.hasOwnProperty(prevEntity)) {
					entities[prevEntity] = [];
				}
				entities[prevEntity].push(entityBuffer.join(' '));
				// Now we set the buffer
				entityBuffer = [];
			}
		}
		// Save the current entity
		prevEntity = tagged[i].t;
	}
	
	
	callback(entities);
}

module.exports		= ner;
},{"child_process":6,"path":7,"underscore":4}],4:[function(require,module,exports){
(function (global){
//     Underscore.js 1.9.1
//     http://underscorejs.org
//     (c) 2009-2018 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` (`self`) in the browser, `global`
  // on the server, or `this` in some virtual machines. We use `self`
  // instead of `window` for `WebWorker` support.
  var root = typeof self == 'object' && self.self === self && self ||
            typeof global == 'object' && global.global === global && global ||
            this ||
            {};

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype;
  var SymbolProto = typeof Symbol !== 'undefined' ? Symbol.prototype : null;

  // Create quick reference variables for speed access to core prototypes.
  var push = ArrayProto.push,
      slice = ArrayProto.slice,
      toString = ObjProto.toString,
      hasOwnProperty = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var nativeIsArray = Array.isArray,
      nativeKeys = Object.keys,
      nativeCreate = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for their old module API. If we're in
  // the browser, add `_` as a global object.
  // (`nodeType` is checked to ensure that `module`
  // and `exports` are not HTML elements.)
  if (typeof exports != 'undefined' && !exports.nodeType) {
    if (typeof module != 'undefined' && !module.nodeType && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.9.1';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      // The 2-argument case is omitted because we’re not using it.
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  var builtinIteratee;

  // An internal function to generate callbacks that can be applied to each
  // element in a collection, returning the desired result — either `identity`,
  // an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (_.iteratee !== builtinIteratee) return _.iteratee(value, context);
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value) && !_.isArray(value)) return _.matcher(value);
    return _.property(value);
  };

  // External wrapper for our callback generator. Users may customize
  // `_.iteratee` if they want additional predicate/iteratee shorthand styles.
  // This abstraction hides the internal-only argCount argument.
  _.iteratee = builtinIteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // Some functions take a variable number of arguments, or a few expected
  // arguments at the beginning and then a variable number of values to operate
  // on. This helper accumulates all remaining arguments past the function’s
  // argument length (or an explicit `startIndex`), into an array that becomes
  // the last argument. Similar to ES6’s "rest parameter".
  var restArguments = function(func, startIndex) {
    startIndex = startIndex == null ? func.length - 1 : +startIndex;
    return function() {
      var length = Math.max(arguments.length - startIndex, 0),
          rest = Array(length),
          index = 0;
      for (; index < length; index++) {
        rest[index] = arguments[index + startIndex];
      }
      switch (startIndex) {
        case 0: return func.call(this, rest);
        case 1: return func.call(this, arguments[0], rest);
        case 2: return func.call(this, arguments[0], arguments[1], rest);
      }
      var args = Array(startIndex + 1);
      for (index = 0; index < startIndex; index++) {
        args[index] = arguments[index];
      }
      args[startIndex] = rest;
      return func.apply(this, args);
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var shallowProperty = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  var has = function(obj, path) {
    return obj != null && hasOwnProperty.call(obj, path);
  }

  var deepGet = function(obj, path) {
    var length = path.length;
    for (var i = 0; i < length; i++) {
      if (obj == null) return void 0;
      obj = obj[path[i]];
    }
    return length ? obj : void 0;
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object.
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = shallowProperty('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  var createReduce = function(dir) {
    // Wrap code that reassigns argument variables in a separate function than
    // the one that accesses `arguments.length` to avoid a perf hit. (#1991)
    var reducer = function(obj, iteratee, memo, initial) {
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      if (!initial) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    };

    return function(obj, iteratee, memo, context) {
      var initial = arguments.length >= 3;
      return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
    };
  };

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var keyFinder = isArrayLike(obj) ? _.findIndex : _.findKey;
    var key = keyFinder(obj, predicate, context);
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = restArguments(function(obj, path, args) {
    var contextPath, func;
    if (_.isFunction(path)) {
      func = path;
    } else if (_.isArray(path)) {
      contextPath = path.slice(0, -1);
      path = path[path.length - 1];
    }
    return _.map(obj, function(context) {
      var method = func;
      if (!method) {
        if (contextPath && contextPath.length) {
          context = deepGet(context, contextPath);
        }
        if (context == null) return void 0;
        method = context[path];
      }
      return method == null ? method : method.apply(context, args);
    });
  });

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value != null && value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value != null && value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection.
  _.shuffle = function(obj) {
    return _.sample(obj, Infinity);
  };

  // Sample **n** random values from a collection using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    var sample = isArrayLike(obj) ? _.clone(obj) : _.values(obj);
    var length = getLength(sample);
    n = Math.max(Math.min(n, length), 0);
    var last = length - 1;
    for (var index = 0; index < n; index++) {
      var rand = _.random(index, last);
      var temp = sample[index];
      sample[index] = sample[rand];
      sample[rand] = temp;
    }
    return sample.slice(0, n);
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    var index = 0;
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, key, list) {
      return {
        value: value,
        index: index++,
        criteria: iteratee(value, key, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior, partition) {
    return function(obj, iteratee, context) {
      var result = partition ? [[], []] : {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (has(result, key)) result[key]++; else result[key] = 1;
  });

  var reStrSymbol = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;
  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (_.isString(obj)) {
      // Keep surrogate pair characters together
      return obj.match(reStrSymbol);
    }
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = group(function(result, value, pass) {
    result[pass ? 0 : 1].push(value);
  }, true);

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null || array.length < 1) return n == null ? void 0 : [];
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null || array.length < 1) return n == null ? void 0 : [];
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, Boolean);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, output) {
    output = output || [];
    var idx = output.length;
    for (var i = 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        // Flatten current level of array or arguments object.
        if (shallow) {
          var j = 0, len = value.length;
          while (j < len) output[idx++] = value[j++];
        } else {
          flatten(value, shallow, strict, output);
          idx = output.length;
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = restArguments(function(array, otherArrays) {
    return _.difference(array, otherArrays);
  });

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // The faster algorithm will not work with an iteratee if the iteratee
  // is not a one-to-one function, so providing an iteratee will disable
  // the faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted && !iteratee) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = restArguments(function(arrays) {
    return _.uniq(flatten(arrays, true, true));
  });

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      var j;
      for (j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = restArguments(function(array, rest) {
    rest = flatten(rest, true, true);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  });

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices.
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = restArguments(_.unzip);

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values. Passing by pairs is the reverse of _.pairs.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions.
  var createPredicateIndexFinder = function(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  };

  // Returns the first index on an array-like that passes a predicate test.
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions.
  var createIndexFinder = function(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
          i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
          length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  };

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    if (!step) {
      step = stop < start ? -1 : 1;
    }

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Chunk a single array into multiple arrays, each containing `count` or fewer
  // items.
  _.chunk = function(array, count) {
    if (count == null || count < 1) return [];
    var result = [];
    var i = 0, length = array.length;
    while (i < length) {
      result.push(slice.call(array, i, i += count));
    }
    return result;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments.
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = restArguments(function(func, context, args) {
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var bound = restArguments(function(callArgs) {
      return executeBound(func, bound, context, this, args.concat(callArgs));
    });
    return bound;
  });

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder by default, allowing any combination of arguments to be
  // pre-filled. Set `_.partial.placeholder` for a custom placeholder argument.
  _.partial = restArguments(function(func, boundArgs) {
    var placeholder = _.partial.placeholder;
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  });

  _.partial.placeholder = _;

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = restArguments(function(obj, keys) {
    keys = flatten(keys, false, false);
    var index = keys.length;
    if (index < 1) throw new Error('bindAll must be passed function names');
    while (index--) {
      var key = keys[index];
      obj[key] = _.bind(obj[key], obj);
    }
  });

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = restArguments(function(func, wait, args) {
    return setTimeout(function() {
      return func.apply(null, args);
    }, wait);
  });

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var timeout, context, args, result;
    var previous = 0;
    if (!options) options = {};

    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };

    var throttled = function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };

    throttled.cancel = function() {
      clearTimeout(timeout);
      previous = 0;
      timeout = context = args = null;
    };

    return throttled;
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, result;

    var later = function(context, args) {
      timeout = null;
      if (args) result = func.apply(context, args);
    };

    var debounced = restArguments(function(args) {
      if (timeout) clearTimeout(timeout);
      if (immediate) {
        var callNow = !timeout;
        timeout = setTimeout(later, wait);
        if (callNow) result = func.apply(this, args);
      } else {
        timeout = _.delay(later, wait, this, args);
      }

      return result;
    });

    debounced.cancel = function() {
      clearTimeout(timeout);
      timeout = null;
    };

    return debounced;
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  _.restArguments = restArguments;

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
    'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  var collectNonEnumProps = function(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  };

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`.
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object.
  // In contrast to _.map it returns an object.
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = _.keys(obj),
        length = keys.length,
        results = {};
    for (var index = 0; index < length; index++) {
      var currentKey = keys[index];
      results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  // The opposite of _.object.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`.
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, defaults) {
    return function(obj) {
      var length = arguments.length;
      if (defaults) obj = Object(obj);
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!defaults || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s).
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test.
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Internal pick helper function to determine if `obj` has key `key`.
  var keyInObj = function(value, key, obj) {
    return key in obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = restArguments(function(obj, keys) {
    var result = {}, iteratee = keys[0];
    if (obj == null) return result;
    if (_.isFunction(iteratee)) {
      if (keys.length > 1) iteratee = optimizeCb(iteratee, keys[1]);
      keys = _.allKeys(obj);
    } else {
      iteratee = keyInObj;
      keys = flatten(keys, false, false);
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  });

  // Return a copy of the object without the blacklisted properties.
  _.omit = restArguments(function(obj, keys) {
    var iteratee = keys[0], context;
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
      if (keys.length > 1) context = keys[1];
    } else {
      keys = _.map(flatten(keys, false, false), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  });

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq, deepEq;
  eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // `null` or `undefined` only equal to itself (strict comparison).
    if (a == null || b == null) return false;
    // `NaN`s are equivalent, but non-reflexive.
    if (a !== a) return b !== b;
    // Exhaust primitive checks
    var type = typeof a;
    if (type !== 'function' && type !== 'object' && typeof b != 'object') return false;
    return deepEq(a, b, aStack, bStack);
  };

  // Internal recursive comparison function for `isEqual`.
  deepEq = function(a, b, aStack, bStack) {
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN.
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
      case '[object Symbol]':
        return SymbolProto.valueOf.call(a) === SymbolProto.valueOf.call(b);
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError, isMap, isWeakMap, isSet, isWeakSet.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error', 'Symbol', 'Map', 'WeakMap', 'Set', 'WeakSet'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), Safari 8 (#1929), and PhantomJS (#2236).
  var nodelist = root.document && root.document.childNodes;
  if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return !_.isSymbol(obj) && isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`?
  _.isNaN = function(obj) {
    return _.isNumber(obj) && isNaN(obj);
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, path) {
    if (!_.isArray(path)) {
      return has(obj, path);
    }
    var length = path.length;
    for (var i = 0; i < length; i++) {
      var key = path[i];
      if (obj == null || !hasOwnProperty.call(obj, key)) {
        return false;
      }
      obj = obj[key];
    }
    return !!length;
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  // Creates a function that, when passed an object, will traverse that object’s
  // properties down the given `path`, specified as an array of keys or indexes.
  _.property = function(path) {
    if (!_.isArray(path)) {
      return shallowProperty(path);
    }
    return function(obj) {
      return deepGet(obj, path);
    };
  };

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    if (obj == null) {
      return function(){};
    }
    return function(path) {
      return !_.isArray(path) ? obj[path] : deepGet(obj, path);
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

  // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped.
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // Traverses the children of `obj` along `path`. If a child is a function, it
  // is invoked with its parent as context. Returns the value of the final
  // child, or `fallback` if any child is undefined.
  _.result = function(obj, path, fallback) {
    if (!_.isArray(path)) path = [path];
    var length = path.length;
    if (!length) {
      return _.isFunction(fallback) ? fallback.call(obj) : fallback;
    }
    for (var i = 0; i < length; i++) {
      var prop = obj == null ? void 0 : obj[path[i]];
      if (prop === void 0) {
        prop = fallback;
        i = length; // Ensure we don't continue iterating.
      }
      obj = _.isFunction(prop) ? prop.call(obj) : prop;
    }
    return obj;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate: /<%([\s\S]+?)%>/g,
    interpolate: /<%=([\s\S]+?)%>/g,
    escape: /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'": "'",
    '\\': '\\',
    '\r': 'r',
    '\n': 'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escapeRegExp = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escapeRegExp, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offset.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    var render;
    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var chainResult = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return chainResult(this, func.apply(_, args));
      };
    });
    return _;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return chainResult(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return chainResult(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return String(this._wrapped);
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define == 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}());

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],5:[function(require,module,exports){
exports.SentimentIntensityAnalyzer=function(e){var s={};function i(r){if(s[r])return s[r].exports;var t=s[r]={i:r,l:!1,exports:{}};return e[r].call(t.exports,t,t.exports,i),t.l=!0,t.exports}return i.m=e,i.c=s,i.d=function(e,s,r){i.o(e,s)||Object.defineProperty(e,s,{configurable:!1,enumerable:!0,get:r})},i.r=function(e){Object.defineProperty(e,"__esModule",{value:!0})},i.n=function(e){var s=e&&e.__esModule?function(){return e.default}:function(){return e};return i.d(s,"a",s),s},i.o=function(e,s){return Object.prototype.hasOwnProperty.call(e,s)},i.p="",i(i.s=2)}([function(e,s,i){"use strict";Object.defineProperty(s,"__esModule",{value:!0});s.lexicon={"$:":-1.5,"%)":-.4,"%-)":-1.5,"&-:":-.4,"&:":-.7,"( '}{' )":1.6,"(%":-.9,"('-:":2.2,"(':":2.3,"((-:":2.1,"(*":1.1,"(-%":-.7,"(-*":1.3,"(-:":1.6,"(-:0":2.8,"(-:<":-.4,"(-:o":1.5,"(-:O":1.5,"(-:{":-.1,"(-:|>*":1.9,"(-;":1.3,"(-;|":2.1,"(8":2.6,"(:":2.2,"(:0":2.4,"(:<":-.2,"(:o":2.5,"(:O":2.5,"(;":1.1,"(;<":.3,"(=":2.2,"(?:":2.1,"(^:":1.5,"(^;":1.5,"(^;0":2,"(^;o":1.9,"(o:":1.6,")':":-2,")-':":-2.1,")-:":-2.1,")-:<":-2.2,")-:{":-2.1,"):":-1.8,"):<":-1.9,"):{":-2.3,");<":-2.6,"*)":.6,"*-)":.3,"*-:":2.1,"*-;":2.4,"*:":1.9,"*<|:-)":1.6,"*\\0/*":2.3,"*^:":1.6,",-:":1.2,"---'-;-{@":2.3,"--<--<@":2.2,".-:":-1.2,"..###-:":-1.7,"..###:":-1.9,"/-:":-1.3,"/:":-1.3,"/:<":-1.4,"/=":-.9,"/^:":-1,"/o:":-1.4,"0-8":.1,"0-|":-1.2,"0:)":1.9,"0:-)":1.4,"0:-3":1.5,"0:03":1.9,"0;^)":1.6,"0_o":-.3,"10q":2.1,1337:2.1,143:3.2,1432:2.6,"14aa41":2.4,182:-2.9,187:-3.1,"2g2b4g":2.8,"2g2bt":-.1,"2qt":2.1,"3:(":-2.2,"3:)":.5,"3:-(":-2.3,"3:-)":-1.4,"4col":-2.2,"4q":-3.1,"5fs":1.5,"8)":1.9,"8-d":1.7,"8-o":-.3,86:-1.6,"8d":2.9,":###..":-2.4,":$":-.2,":&":-.6,":'(":-2.2,":')":2.3,":'-(":-2.4,":'-)":2.7,":(":-1.9,":)":2,":*":2.5,":-###..":-2.5,":-&":-.5,":-(":-1.5,":-)":1.3,":-))":2.8,":-*":1.7,":-,":1.1,":-.":-.9,":-/":-1.2,":-<":-1.5,":-d":2.3,":-D":2.3,":-o":.1,":-[":-1.6,":-\\":-.9,":-c":-1.3,":-p":1.5,":-|":-.7,":-||":-2.5,":-Þ":.9,":/":-1.4,":3":2.3,":<":-2.1,":>":2.1,":?)":1.3,":?c":-1.6,":@":-2.5,":d":2.3,":D":2.3,":l":-1.7,":o":-.4,":p":1,":s":-1.2,":[":-2,":\\":-1.3,":]":2.2,":^)":2.1,":^*":2.6,":^/":-1.2,":^\\":-1,":^|":-1,":c":-2.1,":c)":2,":o)":2.1,":o/":-1.4,":o\\":-1.1,":o|":-.6,":P":1.4,":{":-1.9,":|":-.4,":}":2.1,":Þ":1.1,";)":.9,";-)":1,";-*":2.2,";-]":.7,";d":.8,";D":.8,";]":.6,";^)":1.4,"</3":-3,"<3":1.9,"<:":2.1,"<:-|":-1.4,"=)":2.2,"=-3":2,"=-d":2.4,"=-D":2.4,"=/":-1.4,"=3":2.1,"=d":2.3,"=D":2.3,"=l":-1.2,"=\\":-1.2,"=]":1.6,"=p":1.3,"=|":-.8,">-:":-2,">.<":-1.3,">:":-2.1,">:(":-2.7,">:)":.4,">:-(":-2.7,">:-)":-.4,">:/":-1.6,">:o":-1.2,">:p":1,">:[":-2.1,">:\\":-1.7,">;(":-2.9,">;)":.1,">_>^":2.1,"@:":-2.1,"@>--\x3e--":2.1,"@}-;-'---":2.2,aas:2.5,aayf:2.7,afu:-2.9,alol:2.8,ambw:2.9,aml:3.4,atab:-1.9,awol:-1.3,ayc:.2,ayor:-1.2,"aug-00":.3,bfd:-2.7,bfe:-2.6,bff:2.9,bffn:1,bl:2.3,bsod:-2.2,btd:-2.1,btdt:-.1,bz:.4,"b^d":2.6,cwot:-2.3,"d-':":-2.5,d8:-3.2,"d:<":-3.2,"d;":-2.9,doa:-2.3,dx:-3,ez:1.5,fcol:-1.8,ff:1.8,ffs:-2.8,fkm:-2.4,foaf:1.8,ftw:2,fu:-3.7,fubar:-3,fwb:2.5,fyi:.8,fysa:.4,g1:1.4,gg:1.2,gga:1.7,gigo:-.6,gj:2,gl:1.3,gla:2.5,gn:1.2,gr8:2.7,grrr:-.4,gt:1.1,"h&k":2.3,hagd:2.2,hagn:2.2,hago:1.2,hak:1.9,hand:2.2,"hho1/2k":1.4,hhoj:2,hhok:.9,hugz:2,hi5:1.9,idk:-.4,ijs:.7,ilu:3.4,iluaaf:2.7,ily:3.4,ily2:2.6,iou:.7,iyq:2.3,"j/j":2,"j/k":1.6,"j/p":1.4,"j/t":-.2,"j/w":1,j4f:1.4,j4g:1.7,jho:.8,jhomf:1,jj:1,jk:.9,jp:.8,jt:.9,jw:1.6,jealz:-1.2,k4y:2.3,kfy:2.3,kia:-3.2,kk:1.5,kmuf:2.2,l:2,"l&r":2.2,laoj:1.3,lmbao:1.8,lmfao:2.5,lmso:2.7,lolz:2.7,lts:1.6,ly:2.6,ly4e:2.7,lya:3.3,lyb:3,lyl:3.1,lylab:2.7,lylas:2.6,lylb:1.6,m8:1.4,mia:-1.2,mml:2,mofo:-2.4,mubar:-1,musm:.9,mwah:2.5,n1:1.9,nbd:1.3,nbif:-.5,nfc:-2.7,nfw:-2.4,nh:2.2,nimby:-.8,nimjd:-.7,nimq:-.2,nimy:-1.4,nitl:-1.5,nme:-2.1,noyb:-.7,np:1.4,ntmu:1.4,"o-8":-.5,"o-:":-.3,"o-|":-1.1,"O.o":-.6,"o.O":-.6,"o:":-.2,"o:)":1.5,"o:-)":2,"o:-3":2.2,"o:3":2.3,"o:<":-.3,"o;^)":1.6,o_o:-.5,O_o:-.5,o_O:-.5,pita:-2.4,pls:.3,plz:.3,pmbi:.8,pmfji:.3,pmji:.7,po:-2.6,ptl:2.6,pu:-1.1,qq:-2.2,qt:1.8,"r&r":2.4,rofl:2.7,roflmao:2.5,rotfl:2.6,rotflmao:2.8,rotflmfao:2.5,rotflol:3,rotgl:2.9,rotglmao:1.8,"s:":-1.1,sapfu:-1.1,sete:2.8,sfete:2.7,sgtm:2.4,slap:.6,slaw:2.1,smh:-1.3,snafu:-2.5,swak:2.3,tgif:2.3,thks:1.4,thx:1.5,tia:2.3,tmi:-.3,tnx:1.1,true:1.8,tx:1.5,txs:1.1,ty:1.6,tyvm:2.5,urw:1.9,vbg:2.1,vbs:3.1,vip:2.3,vwd:2.6,vwp:2.1,wag:-.2,wd:2.7,wilco:.9,wp:1,wtf:-2.8,wtg:2.1,wth:-2.4,xlnt:3,xoxo:3,xoxozzz:2.3,xqzt:1.6,xtc:.8,yolo:1.1,yoyo:.4,yvw:1.6,yw:1.8,ywia:2.5,zzz:-1.2,"[-;":.5,"[:":1.3,"[;":1,"[=":1.7,"\\-:":-1,"\\:":-1,"\\:<":-1.7,"\\=":-1.1,"\\^:":-1.3,"\\o/":2.2,"\\o:":-1.2,"]-:":-2.1,"]:":-1.6,"]:<":-2.5,"^<_<":1.4,"^urs":-2.8,abandon:-1.9,abandoned:-2,abandoner:-1.9,abandoners:-1.9,abandoning:-1.6,abandonment:-2.4,abandonments:-1.7,abandons:-1.3,abducted:-2.3,abduction:-2.8,abductions:-2,abhor:-2,abhorred:-2.4,abhorrent:-3.1,abhors:-2.9,abilities:1,ability:1.3,aboard:.1,absentee:-1.1,absentees:-.8,absolve:1.2,absolved:1.5,absolves:1.3,absolving:1.6,abuse:-3.2,abused:-2.3,abuser:-2.6,abusers:-2.6,abuses:-2.6,abusing:-2,abusive:-3.2,abusively:-2.8,abusiveness:-2.5,abusivenesses:-3,accept:1.6,acceptabilities:1.6,acceptability:1.1,acceptable:1.3,acceptableness:1.3,acceptably:1.5,acceptance:2,acceptances:1.7,acceptant:1.6,acceptation:1.3,acceptations:.9,accepted:1.1,accepting:1.6,accepts:1.3,accident:-2.1,accidental:-.3,accidentally:-1.4,accidents:-1.3,accomplish:1.8,accomplished:1.9,accomplishes:1.7,accusation:-1,accusations:-1.3,accuse:-.8,accused:-1.2,accuses:-1.4,accusing:-.7,ache:-1.6,ached:-1.6,aches:-1,achievable:1.3,aching:-2.2,acquit:.8,acquits:.1,acquitted:1,acquitting:1.3,acrimonious:-1.7,active:1.7,actively:1.3,activeness:.6,activenesses:.8,actives:1.1,adequate:.9,admirability:2.4,admirable:2.6,admirableness:2.2,admirably:2.5,admiral:1.3,admirals:1.5,admiralties:1.6,admiralty:1.2,admiration:2.5,admirations:1.6,admire:2.1,admired:2.3,admirer:1.8,admirers:1.7,admires:1.5,admiring:1.6,admiringly:2.3,admit:.8,admits:1.2,admitted:.4,admonished:-1.9,adopt:.7,adopts:.7,adorability:2.2,adorable:2.2,adorableness:2.5,adorably:2.1,adoration:2.9,adorations:2.2,adore:2.6,adored:1.8,adorer:1.7,adorers:2.1,adores:1.6,adoring:2.6,adoringly:2.4,adorn:.9,adorned:.8,adorner:1.3,adorners:.9,adorning:1,adornment:1.3,adornments:.8,adorns:.5,advanced:1,advantage:1,advantaged:1.4,advantageous:1.5,advantageously:1.9,advantageousness:1.6,advantages:1.5,advantaging:1.6,adventure:1.3,adventured:1.3,adventurer:1.2,adventurers:.9,adventures:1.4,adventuresome:1.7,adventuresomeness:1.3,adventuress:.8,adventuresses:1.4,adventuring:2.3,adventurism:1.5,adventurist:1.4,adventuristic:1.7,adventurists:1.2,adventurous:1.4,adventurously:1.3,adventurousness:1.8,adversarial:-1.5,adversaries:-1,adversary:-.8,adversative:-1.2,adversatively:-.1,adversatives:-1,adverse:-1.5,adversely:-.8,adverseness:-.6,adversities:-1.5,adversity:-1.8,affected:-.6,affection:2.4,affectional:1.9,affectionally:1.5,affectionate:1.9,affectionately:2.2,affectioned:1.8,affectionless:-2,affections:1.5,afflicted:-1.5,affronted:.2,aggravate:-2.5,aggravated:-1.9,aggravates:-1.9,aggravating:-1.2,aggress:-1.3,aggressed:-1.4,aggresses:-.5,aggressing:-.6,aggression:-1.2,aggressions:-1.3,aggressive:-.6,aggressively:-1.3,aggressiveness:-1.8,aggressivities:-1.4,aggressivity:-.6,aggressor:-.8,aggressors:-.9,aghast:-1.9,agitate:-1.7,agitated:-2,agitatedly:-1.6,agitates:-1.4,agitating:-1.8,agitation:-1,agitational:-1.2,agitations:-1.3,agitative:-1.3,agitato:-.1,agitator:-1.4,agitators:-2.1,agog:1.9,agonise:-2.1,agonised:-2.3,agonises:-2.4,agonising:-1.5,agonize:-2.3,agonized:-2.2,agonizes:-2.3,agonizing:-2.7,agonizingly:-2.3,agony:-1.8,agree:1.5,agreeability:1.9,agreeable:1.8,agreeableness:1.8,agreeablenesses:1.3,agreeably:1.6,agreed:1.1,agreeing:1.4,agreement:2.2,agreements:1.1,agrees:.8,alarm:-1.4,alarmed:-1.4,alarming:-.5,alarmingly:-2.6,alarmism:-.3,alarmists:-1.1,alarms:-1.1,alas:-1.1,alert:1.2,alienation:-1.1,alive:1.6,allergic:-1.2,allow:.9,alone:-1,alright:1,amaze:2.5,amazed:2.2,amazedly:2.1,amazement:2.5,amazements:2.2,amazes:2.2,amazing:2.8,amazon:.7,amazonite:.2,amazons:-.1,amazonstone:1,amazonstones:.2,ambitious:2.1,ambivalent:.5,amor:3,amoral:-1.6,amoralism:-.7,amoralisms:-.7,amoralities:-1.2,amorality:-1.5,amorally:-1,amoretti:.2,amoretto:.6,amorettos:.3,amorino:1.2,amorist:1.6,amoristic:1,amorists:.1,amoroso:2.3,amorous:1.8,amorously:2.3,amorousness:2,amorphous:-.2,amorphously:.1,amorphousness:.3,amort:-2.1,amortise:.5,amortised:-.2,amortises:.1,amortizable:.5,amortization:.6,amortizations:.2,amortize:-.1,amortized:.8,amortizes:.6,amortizing:.8,amusable:.7,amuse:1.7,amused:1.8,amusedly:2.2,amusement:1.5,amusements:1.5,amuser:1.1,amusers:1.3,amuses:1.7,amusia:.3,amusias:-.4,amusing:1.6,amusingly:.8,amusingness:1.8,amusive:1.7,anger:-2.7,angered:-2.3,angering:-2.2,angerly:-1.9,angers:-2.3,angrier:-2.3,angriest:-3.1,angrily:-1.8,angriness:-1.7,angry:-2.3,anguish:-2.9,anguished:-1.8,anguishes:-2.1,anguishing:-2.7,animosity:-1.9,annoy:-1.9,annoyance:-1.3,annoyances:-1.8,annoyed:-1.6,annoyer:-2.2,annoyers:-1.5,annoying:-1.7,annoys:-1.8,antagonism:-1.9,antagonisms:-1.2,antagonist:-1.9,antagonistic:-1.7,antagonistically:-2.2,antagonists:-1.7,antagonize:-2,antagonized:-1.4,antagonizes:-.5,antagonizing:-2.7,anti:-1.3,anticipation:.4,anxieties:-.6,anxiety:-.7,anxious:-1,anxiously:-.9,anxiousness:-1,aok:2,apathetic:-1.2,apathetically:-.4,apathies:-.6,apathy:-1.2,apeshit:-.9,apocalyptic:-3.4,apologise:1.6,apologised:.4,apologises:.8,apologising:.2,apologize:.4,apologized:1.3,apologizes:1.5,apologizing:-.3,apology:.2,appall:-2.4,appalled:-2,appalling:-1.5,appallingly:-2,appalls:-1.9,appease:1.1,appeased:.9,appeases:.9,appeasing:1,applaud:2,applauded:1.5,applauding:2.1,applauds:1.4,applause:1.8,appreciate:1.7,appreciated:2.3,appreciates:2.3,appreciating:1.9,appreciation:2.3,appreciations:1.7,appreciative:2.6,appreciatively:1.8,appreciativeness:1.6,appreciator:2.6,appreciators:1.5,appreciatory:1.7,apprehensible:1.1,apprehensibly:-.2,apprehension:-2.1,apprehensions:-.9,apprehensively:-.3,apprehensiveness:-.7,approval:2.1,approved:1.8,approves:1.7,ardent:2.1,arguable:-1,arguably:-1,argue:-1.4,argued:-1.5,arguer:-1.6,arguers:-1.4,argues:-1.6,arguing:-2,argument:-1.5,argumentative:-1.5,argumentatively:-1.8,argumentive:-1.5,arguments:-1.7,arrest:-1.4,arrested:-2.1,arrests:-1.9,arrogance:-2.4,arrogances:-1.9,arrogant:-2.2,arrogantly:-1.8,ashamed:-2.1,ashamedly:-1.7,ass:-2.5,assassination:-2.9,assassinations:-2.7,assault:-2.8,assaulted:-2.4,assaulting:-2.3,assaultive:-2.8,assaults:-2.5,asset:1.5,assets:.7,assfucking:-2.5,assholes:-2.8,assurance:1.4,assurances:1.4,assure:1.4,assured:1.5,assuredly:1.6,assuredness:1.4,assurer:.9,assurers:1.1,assures:1.3,assurgent:1.3,assuring:1.6,assuror:.5,assurors:.7,astonished:1.6,astound:1.7,astounded:1.8,astounding:1.8,astoundingly:2.1,astounds:2.1,attachment:1.2,attachments:1.1,attack:-2.1,attacked:-2,attacker:-2.7,attackers:-2.7,attacking:-2,attacks:-1.9,attract:1.5,attractancy:.9,attractant:1.3,attractants:1.4,attracted:1.8,attracting:2.1,attraction:2,attractions:1.8,attractive:1.9,attractively:2.2,attractiveness:1.8,attractivenesses:2.1,attractor:1.2,attractors:1.2,attracts:1.7,audacious:.9,authority:.3,aversion:-1.9,aversions:-1.1,aversive:-1.6,aversively:-.8,avert:-.7,averted:-.3,averts:-.4,avid:1.2,avoid:-1.2,avoidance:-1.7,avoidances:-1.1,avoided:-1.4,avoider:-1.8,avoiders:-1.4,avoiding:-1.4,avoids:-.7,await:.4,awaited:-.1,awaits:.3,award:2.5,awardable:2.4,awarded:1.7,awardee:1.8,awardees:1.2,awarder:.9,awarders:1.3,awarding:1.9,awards:2,awesome:3.1,awful:-2,awkward:-.6,awkwardly:-1.3,awkwardness:-.7,axe:-.4,axed:-1.3,backed:.1,backing:.1,backs:-.2,bad:-2.5,badass:-.6,badly:-2.1,bailout:-.4,bamboozle:-1.5,bamboozled:-1.5,bamboozles:-1.5,ban:-2.6,banish:-1.9,bankrupt:-2.6,bankster:-2.1,banned:-2,bargain:.8,barrier:-.5,bashful:-.1,bashfully:.2,bashfulness:-.8,bastard:-2.5,bastardies:-1.8,bastardise:-2.1,bastardised:-2.3,bastardises:-2.3,bastardising:-2.6,bastardization:-2.4,bastardizations:-2.1,bastardize:-2.4,bastardized:-2,bastardizes:-1.8,bastardizing:-2.3,bastardly:-2.7,bastards:-3,bastardy:-2.7,battle:-1.6,battled:-1.2,battlefield:-1.6,battlefields:-.9,battlefront:-1.2,battlefronts:-.8,battleground:-1.7,battlegrounds:-.6,battlement:-.4,battlements:-.4,battler:-.8,battlers:-.2,battles:-1.6,battleship:-.1,battleships:-.5,battlewagon:-.3,battlewagons:-.5,battling:-1.1,beaten:-1.8,beatific:1.8,beating:-2,beaut:1.6,beauteous:2.5,beauteously:2.6,beauteousness:2.7,beautician:1.2,beauticians:.4,beauties:2.4,beautification:1.9,beautifications:2.4,beautified:2.1,beautifier:1.7,beautifiers:1.7,beautifies:1.8,beautiful:2.9,beautifuler:2.1,beautifulest:2.6,beautifully:2.7,beautifulness:2.6,beautify:2.3,beautifying:2.3,beauts:1.7,beauty:2.8,belittle:-1.9,belittled:-2,beloved:2.3,benefic:1.4,benefice:.4,beneficed:1.1,beneficence:2.8,beneficences:1.5,beneficent:2.3,beneficently:2.2,benefices:1.1,beneficial:1.9,beneficially:2.4,beneficialness:1.7,beneficiaries:1.8,beneficiary:2.1,beneficiate:1,beneficiation:.4,benefit:2,benefits:1.6,benefitted:1.7,benefitting:1.9,benevolence:1.7,benevolences:1.9,benevolent:2.7,benevolently:1.4,benevolentness:1.2,benign:1.3,benignancy:.6,benignant:2.2,benignantly:1.1,benignities:.9,benignity:1.3,benignly:.2,bereave:-2.1,bereaved:-2.1,bereaves:-1.9,bereaving:-1.3,best:3.2,betray:-3.2,betrayal:-2.8,betrayed:-3,betraying:-2.5,betrays:-2.5,better:1.9,bias:-.4,biased:-1.1,bitch:-2.8,bitched:-2.6,bitcheries:-2.3,bitchery:-2.7,bitches:-2.9,bitchier:-2,bitchiest:-3,bitchily:-2.6,bitchiness:-2.6,bitching:-1.1,bitchy:-2.3,bitter:-1.8,bitterbrush:-.2,bitterbrushes:-.6,bittered:-1.8,bitterer:-1.9,bitterest:-2.3,bittering:-1.2,bitterish:-1.6,bitterly:-2,bittern:-.2,bitterness:-1.7,bitterns:-.4,bitterroots:-.2,bitters:-.4,bittersweet:-.3,bittersweetness:-.6,bittersweets:-.2,bitterweeds:-.5,bizarre:-1.3,blah:-.4,blam:-.2,blamable:-1.8,blamably:-1.8,blame:-1.4,blamed:-2.1,blameful:-1.7,blamefully:-1.6,blameless:.7,blamelessly:.9,blamelessness:.6,blamer:-2.1,blamers:-2,blames:-1.7,blameworthiness:-1.6,blameworthy:-2.3,blaming:-2.2,bless:1.8,blessed:2.9,blesseder:2,blessedest:2.8,blessedly:1.7,blessedness:1.6,blesser:2.6,blessers:1.9,blesses:2.6,blessing:2.2,blessings:2.5,blind:-1.7,bliss:2.7,blissful:2.9,blithe:1.2,block:-1.9,blockbuster:2.9,blocked:-1.1,blocking:-1.6,blocks:-.9,bloody:-1.9,blurry:-.4,bold:1.6,bolder:1.2,boldest:1.6,boldface:.3,boldfaced:-.1,boldfaces:.1,boldfacing:.1,boldly:1.5,boldness:1.5,boldnesses:.9,bolds:1.3,bomb:-2.2,bonus:2.5,bonuses:2.6,boost:1.7,boosted:1.5,boosting:1.4,boosts:1.3,bore:-1,boreal:-.3,borecole:-.2,borecoles:-.3,bored:-1.1,boredom:-1.3,boredoms:-1.1,boreen:.1,boreens:.2,boreholes:-.2,borer:-.4,borers:-1.2,bores:-1.3,borescopes:-.1,boresome:-1.3,boring:-1.3,bother:-1.4,botheration:-1.7,botherations:-1.3,bothered:-1.3,bothering:-1.6,bothers:-.8,bothersome:-1.3,boycott:-1.3,boycotted:-1.7,boycotting:-1.7,boycotts:-1.4,brainwashing:-1.5,brave:2.4,braved:1.9,bravely:2.3,braver:2.4,braveries:2,bravery:2.2,braves:1.9,bravest:2.3,breathtaking:2,bribe:-.8,bright:1.9,brighten:1.9,brightened:2.1,brightener:1,brighteners:1,brightening:2.5,brightens:1.5,brighter:1.6,brightest:3,brightly:1.5,brightness:1.6,brightnesses:1.4,brights:.4,brightwork:1.1,brilliance:2.9,brilliances:2.9,brilliancies:2.3,brilliancy:2.6,brilliant:2.8,brilliantine:.8,brilliantines:2,brilliantly:3,brilliants:1.9,brisk:.6,broke:-1.8,broken:-2.1,brooding:.1,brutal:-3.1,brutalise:-2.7,brutalised:-2.9,brutalises:-3.2,brutalising:-2.8,brutalities:-2.6,brutality:-3,brutalization:-2.1,brutalizations:-2.3,brutalize:-2.9,brutalized:-2.4,brutalizes:-3.2,brutalizing:-3.4,brutally:-3,bullied:-3.1,bullshit:-2.8,bully:-2.2,bullying:-2.9,bummer:-1.6,buoyant:.9,burden:-1.9,burdened:-1.7,burdener:-1.3,burdeners:-1.7,burdening:-1.4,burdens:-1.5,burdensome:-1.8,bwahaha:.4,bwahahah:2.5,calm:1.3,calmative:1.1,calmatives:.5,calmed:1.6,calmer:1.5,calmest:1.6,calming:1.7,calmly:1.3,calmness:1.7,calmnesses:1.6,calmodulin:.2,calms:1.3,"can't stand":-2,cancel:-1,cancelled:-1,cancelling:-.8,cancels:-.9,cancer:-3.4,capable:1.6,captivated:1.6,care:2.2,cared:1.8,carefree:1.7,careful:.6,carefully:.5,carefulness:2,careless:-1.5,carelessly:-1,carelessness:-1.4,carelessnesses:-1.6,cares:2,caring:2.2,casual:.8,casually:.7,casualty:-2.4,catastrophe:-3.4,catastrophic:-2.2,cautious:-.4,celebrate:2.7,celebrated:2.7,celebrates:2.7,celebrating:2.7,censor:-2,censored:-.6,censors:-1.2,certain:1.1,certainly:1.4,certainties:.9,certainty:1,chagrin:-1.9,chagrined:-1.4,challenge:.3,challenged:-.4,challenger:.5,challengers:.4,challenges:.3,challenging:.6,challengingly:-.6,champ:2.1,champac:-.2,champagne:1.2,champagnes:.5,champaign:.2,champaigns:.5,champaks:-.2,champed:1,champer:-.1,champers:.5,champerties:-.1,champertous:.3,champerty:-.2,champignon:.4,champignons:.2,champing:.7,champion:2.9,championed:1.2,championing:1.8,champions:2.4,championship:1.9,championships:2.2,champs:1.8,champy:1,chance:1,chances:.8,chaos:-2.7,chaotic:-2.2,charged:-.8,charges:-1.1,charitable:1.7,charitableness:1.9,charitablenesses:1.6,charitably:1.4,charities:2.2,charity:1.8,charm:1.7,charmed:2,charmer:1.9,charmers:2.1,charmeuse:.3,charmeuses:.4,charming:2.8,charminger:1.5,charmingest:2.4,charmingly:2.2,charmless:-1.8,charms:1.9,chastise:-2.5,chastised:-2.2,chastises:-1.7,chastising:-1.7,cheat:-2,cheated:-2.3,cheater:-2.5,cheaters:-1.9,cheating:-2.6,cheats:-1.8,cheer:2.3,cheered:2.3,cheerer:1.7,cheerers:1.8,cheerful:2.5,cheerfuller:1.9,cheerfullest:3.2,cheerfully:2.1,cheerfulness:2.1,cheerier:2.6,cheeriest:2.2,cheerily:2.5,cheeriness:2.5,cheering:2.3,cheerio:1.2,cheerlead:1.7,cheerleader:.9,cheerleaders:1.2,cheerleading:1.2,cheerleads:1.2,cheerled:1.5,cheerless:-1.7,cheerlessly:-.8,cheerlessness:-1.7,cheerly:2.4,cheers:2.1,cheery:2.6,cherish:1.6,cherishable:2,cherished:2.3,cherisher:2.2,cherishers:1.9,cherishes:2.2,cherishing:2,chic:1.1,childish:-1.2,chilling:-.1,choke:-2.5,choked:-2.1,chokes:-2,choking:-2,chuckle:1.7,chuckled:1.2,chucklehead:-1.9,chuckleheaded:-1.3,chuckleheads:-1.1,chuckler:.8,chucklers:1.2,chuckles:1.1,chucklesome:1.1,chuckling:1.4,chucklingly:1.2,clarifies:.9,clarity:1.7,classy:1.9,clean:1.7,cleaner:.7,clear:1.6,cleared:.4,clearly:1.7,clears:.3,clever:2,cleverer:2,cleverest:2.6,cleverish:1,cleverly:2.3,cleverness:2.3,clevernesses:1.4,clouded:-.2,clueless:-1.5,cock:-.6,cocksucker:-3.1,cocksuckers:-2.6,cocky:-.5,coerced:-1.5,collapse:-2.2,collapsed:-1.1,collapses:-1.2,collapsing:-1.2,collide:-.3,collides:-1.1,colliding:-.5,collision:-1.5,collisions:-1.1,colluding:-1.2,combat:-1.4,combats:-.8,comedian:1.6,comedians:1.2,comedic:1.7,comedically:2.1,comedienne:.6,comediennes:1.6,comedies:1.7,comedo:.3,comedones:-.8,comedown:-.8,comedowns:-.9,comedy:1.5,comfort:1.5,comfortable:2.3,comfortableness:1.3,comfortably:1.8,comforted:1.8,comforter:1.9,comforters:1.2,comforting:1.7,comfortingly:1.7,comfortless:-1.8,comforts:2.1,commend:1.9,commended:1.9,commit:1.2,commitment:1.6,commitments:.5,commits:.1,committed:1.1,committing:.3,compassion:2,compassionate:2.2,compassionated:1.6,compassionately:1.7,compassionateness:.9,compassionates:1.6,compassionating:1.6,compassionless:-2.6,compelled:.2,compelling:.9,competent:1.3,competitive:.7,complacent:-.3,complain:-1.5,complainant:-.7,complainants:-1.1,complained:-1.7,complainer:-1.8,complainers:-1.3,complaining:-.8,complainingly:-1.7,complains:-1.6,complaint:-1.2,complaints:-1.7,compliment:2.1,complimentarily:1.7,complimentary:1.9,complimented:1.8,complimenting:2.3,compliments:1.7,comprehensive:1,conciliate:1,conciliated:1.1,conciliates:1.1,conciliating:1.3,condemn:-1.6,condemnation:-2.8,condemned:-1.9,condemns:-2.3,confidence:2.3,confident:2.2,confidently:2.1,conflict:-1.3,conflicting:-1.7,conflictive:-1.8,conflicts:-1.6,confront:-.7,confrontation:-1.3,confrontational:-1.6,confrontationist:-1,confrontationists:-1.2,confrontations:-1.5,confronted:-.8,confronter:-.3,confronters:-1.3,confronting:-.6,confronts:-.9,confuse:-.9,confused:-1.3,confusedly:-.6,confusedness:-1.5,confuses:-1.3,confusing:-.9,confusingly:-1.4,confusion:-1.2,confusional:-1.2,confusions:-.9,congrats:2.4,congratulate:2.2,congratulation:2.9,congratulations:2.9,consent:.9,consents:1,considerate:1.9,consolable:1.1,conspiracy:-2.4,constrained:-.4,contagion:-2,contagions:-1.5,contagious:-1.4,contempt:-2.8,contemptibilities:-2,contemptibility:-.9,contemptible:-1.6,contemptibleness:-1.9,contemptibly:-1.4,contempts:-1,contemptuous:-2.2,contemptuously:-2.4,contemptuousness:-1.1,contend:.2,contender:.5,contented:1.4,contentedly:1.9,contentedness:1.4,contentious:-1.2,contentment:1.5,contestable:.6,contradict:-1.3,contradictable:-1,contradicted:-1.3,contradicting:-1.3,contradiction:-1,contradictions:-1.3,contradictious:-1.9,contradictor:-1,contradictories:-.5,contradictorily:-.9,contradictoriness:-1.4,contradictors:-1.6,contradictory:-1.4,contradicts:-1.4,controversial:-.8,controversially:-1.1,convince:1,convinced:1.7,convincer:.6,convincers:.3,convinces:.7,convincing:1.7,convincingly:1.6,convincingness:.7,convivial:1.2,cool:1.3,cornered:-1.1,corpse:-2.7,costly:-.4,courage:2.2,courageous:2.4,courageously:2.3,courageousness:2.1,courteous:2.3,courtesy:1.5,"cover-up":-1.2,coward:-2,cowardly:-1.6,coziness:1.5,cramp:-.8,crap:-1.6,crappy:-2.6,crash:-1.7,craze:-.6,crazed:-.5,crazes:.2,crazier:-.1,craziest:-.2,crazily:-1.5,craziness:-1.6,crazinesses:-1,crazing:-.5,crazy:-1.4,crazyweed:.8,create:1.1,created:1,creates:1.1,creatin:.1,creatine:.2,creating:1.2,creatinine:.4,creation:1.1,creationism:.7,creationisms:1.1,creationist:.8,creationists:.5,creations:1.6,creative:1.9,creatively:1.5,creativeness:1.8,creativities:1.7,creativity:1.6,credit:1.6,creditabilities:1.4,creditability:1.9,creditable:1.8,creditableness:1.2,creditably:1.7,credited:1.5,crediting:.6,creditor:-.1,credits:1.5,creditworthiness:1.9,creditworthy:2.4,crestfallen:-2.5,cried:-1.6,cries:-1.7,crime:-2.5,criminal:-2.4,criminals:-2.7,crisis:-3.1,critic:-1.1,critical:-1.3,criticise:-1.9,criticised:-1.8,criticises:-1.3,criticising:-1.7,criticism:-1.9,criticisms:-.9,criticizable:-1,criticize:-1.6,criticized:-1.5,criticizer:-1.5,criticizers:-1.6,criticizes:-1.4,criticizing:-1.5,critics:-1.2,crude:-2.7,crudely:-1.2,crudeness:-2,crudenesses:-2,cruder:-2,crudes:-1.1,crudest:-2.4,cruel:-2.8,crueler:-2.3,cruelest:-2.6,crueller:-2.4,cruellest:-2.9,cruelly:-2.8,cruelness:-2.9,cruelties:-2.3,cruelty:-2.9,crush:-.6,crushed:-1.8,crushes:-1.9,crushing:-1.5,cry:-2.1,crying:-2.1,cunt:-2.2,cunts:-2.9,curious:1.3,curse:-2.5,cut:-1.1,cute:2,cutely:1.3,cuteness:2.3,cutenesses:1.9,cuter:2.3,cutes:1.8,cutesie:1,cutesier:1.5,cutesiest:2.2,cutest:2.8,cutesy:2.1,cutey:2.1,cuteys:1.5,cutie:1.5,cutiepie:2,cuties:2.2,cuts:-1.2,cutting:-.5,cynic:-1.4,cynical:-1.6,cynically:-1.3,cynicism:-1.7,cynicisms:-1.7,cynics:-.3,"d-:":1.6,"d:":1.2,"d=":1.5,damage:-2.2,damaged:-1.9,damager:-1.9,damagers:-2,damages:-1.9,damaging:-2.3,damagingly:-2,damn:-1.7,damnable:-1.7,damnableness:-1.8,damnably:-1.7,damnation:-2.6,damnations:-1.4,damnatory:-2.6,damned:-1.6,damnedest:-.5,damnified:-2.8,damnifies:-1.8,damnify:-2.2,damnifying:-2.4,damning:-1.4,damningly:-2,damnit:-2.4,damns:-2.2,danger:-2.4,dangered:-2.4,dangering:-2.5,dangerous:-2.1,dangerously:-2,dangerousness:-2,dangers:-2.2,daredevil:.5,daring:1.5,daringly:2.1,daringness:1.4,darings:.4,darkest:-2.2,darkness:-1,darling:2.8,darlingly:1.6,darlingness:2.3,darlings:2.2,dauntless:2.3,daze:-.7,dazed:-.7,dazedly:-.4,dazedness:-.5,dazes:-.3,dead:-3.3,deadlock:-1.4,deafening:-1.2,dear:1.6,dearer:1.9,dearest:2.6,dearie:2.2,dearies:1,dearly:1.8,dearness:2,dears:1.9,dearth:-2.3,dearths:-.9,deary:1.9,death:-2.9,debonair:.8,debt:-1.5,decay:-1.7,decayed:-1.6,decayer:-1.6,decayers:-1.6,decaying:-1.7,decays:-1.7,deceit:-2,deceitful:-1.9,deceive:-1.7,deceived:-1.9,deceives:-1.6,deceiving:-1.4,deception:-1.9,decisive:.9,dedicated:2,defeat:-2,defeated:-2.1,defeater:-1.4,defeaters:-.9,defeating:-1.6,defeatism:-1.3,defeatist:-1.7,defeatists:-2.1,defeats:-1.3,defeature:-1.9,defeatures:-1.5,defect:-1.4,defected:-1.7,defecting:-1.8,defection:-1.4,defections:-1.5,defective:-1.9,defectively:-2.1,defectiveness:-1.8,defectives:-1.8,defector:-1.9,defectors:-1.3,defects:-1.7,defence:.4,defenceman:.4,defencemen:.6,defences:-.2,defender:.4,defenders:.3,defense:.5,defenseless:-1.4,defenselessly:-1.1,defenselessness:-1.3,defenseman:.1,defensemen:-.4,defenses:.7,defensibility:.4,defensible:.8,defensibly:.1,defensive:.1,defensively:-.6,defensiveness:-.4,defensives:-.3,defer:-1.2,deferring:-.7,defiant:-.9,deficit:-1.7,definite:1.1,definitely:1.7,degradable:-1,degradation:-2.4,degradations:-1.5,degradative:-2,degrade:-1.9,degraded:-1.8,degrader:-2,degraders:-2,degrades:-2.1,degrading:-2.8,degradingly:-2.7,dehumanize:-1.8,dehumanized:-1.9,dehumanizes:-1.5,dehumanizing:-2.4,deject:-2.2,dejected:-2.2,dejecting:-2.3,dejects:-2,delay:-1.3,delayed:-.9,delectable:2.9,delectables:1.4,delectably:2.8,delicate:.2,delicately:1,delicates:.6,delicatessen:.4,delicatessens:.4,delicious:2.7,deliciously:1.9,deliciousness:1.8,delight:2.9,delighted:2.3,delightedly:2.4,delightedness:2.1,delighter:2,delighters:2.6,delightful:2.8,delightfully:2.7,delightfulness:2.1,delighting:1.6,delights:2,delightsome:2.3,demand:-.5,demanded:-.9,demanding:-.9,demonstration:.4,demoralized:-1.6,denied:-1.9,denier:-1.5,deniers:-1.1,denies:-1.8,denounce:-1.4,denounces:-1.9,deny:-1.4,denying:-1.4,depress:-2.2,depressant:-1.6,depressants:-1.6,depressed:-2.3,depresses:-2.2,depressible:-1.7,depressing:-1.6,depressingly:-2.3,depression:-2.7,depressions:-2.2,depressive:-1.6,depressively:-2.1,depressives:-1.5,depressor:-1.8,depressors:-1.7,depressurization:-.3,depressurizations:-.4,depressurize:-.5,depressurized:-.3,depressurizes:-.3,depressurizing:-.7,deprival:-2.1,deprivals:-1.2,deprivation:-1.8,deprivations:-1.8,deprive:-2.1,deprived:-2.1,depriver:-1.6,deprivers:-1.4,deprives:-1.7,depriving:-2,derail:-1.2,derailed:-1.4,derails:-1.3,deride:-1.1,derided:-.8,derides:-1,deriding:-1.5,derision:-1.2,desirable:1.3,desire:1.7,desired:1.1,desirous:1.3,despair:-1.3,despaired:-2.7,despairer:-1.3,despairers:-1.3,despairing:-2.3,despairingly:-2.2,despairs:-2.7,desperate:-1.3,desperately:-1.6,desperateness:-1.5,desperation:-2,desperations:-2.2,despise:-1.4,despised:-1.7,despisement:-2.4,despisements:-2.5,despiser:-1.8,despisers:-1.6,despises:-2,despising:-2.7,despondent:-2.1,destroy:-2.5,destroyed:-2.2,destroyer:-2,destroyers:-2.3,destroying:-2.6,destroys:-2.6,destruct:-2.4,destructed:-1.9,destructibility:-1.8,destructible:-1.5,destructing:-2.5,destruction:-2.7,destructionist:-2.6,destructionists:-2.1,destructions:-2.3,destructive:-3,destructively:-2.4,destructiveness:-2.4,destructivity:-2.2,destructs:-2.4,detached:-.5,detain:-1.8,detained:-1.7,detention:-1.5,determinable:.9,determinableness:.2,determinably:.9,determinacy:1,determinant:.2,determinantal:-.3,determinate:.8,determinately:1.2,determinateness:1.1,determination:1.7,determinations:.8,determinative:1.1,determinatives:.9,determinator:1.1,determined:1.4,devastate:-3.1,devastated:-3,devastates:-2.8,devastating:-3.3,devastatingly:-2.4,devastation:-1.8,devastations:-1.9,devastative:-3.2,devastator:-2.8,devastators:-2.9,devil:-3.4,deviled:-1.6,devilfish:-.8,devilfishes:-.6,deviling:-2.2,devilish:-2.1,devilishly:-1.6,devilishness:-2.3,devilkin:-2.4,devilled:-2.3,devilling:-1.8,devilment:-1.9,devilments:-1.1,devilries:-1.6,devilry:-2.8,devils:-2.7,deviltries:-1.5,deviltry:-2.8,devilwood:-.8,devilwoods:-1,devote:1.4,devoted:1.7,devotedly:1.6,devotedness:2,devotee:1.6,devotees:.5,devotement:1.5,devotements:1.1,devotes:1.6,devoting:2.1,devotion:2,devotional:1.2,devotionally:2.2,devotionals:1.2,devotions:1.8,diamond:1.4,dick:-2.3,dickhead:-3.1,die:-2.9,died:-2.6,difficult:-1.5,difficulties:-1.2,difficultly:-1.7,difficulty:-1.4,diffident:-1,dignified:2.2,dignifies:2,dignify:1.8,dignifying:2.1,dignitaries:.6,dignitary:1.9,dignities:1.4,dignity:1.7,dilemma:-.7,dipshit:-2.1,dire:-2,direful:-3.1,dirt:-1.4,dirtier:-1.4,dirtiest:-2.4,dirty:-1.9,disabling:-2.1,disadvantage:-1.8,disadvantaged:-1.7,disadvantageous:-1.8,disadvantageously:-2.1,disadvantageousness:-1.6,disadvantages:-1.7,disagree:-1.6,disagreeable:-1.7,disagreeableness:-1.7,disagreeablenesses:-1.9,disagreeably:-1.5,disagreed:-1.3,disagreeing:-1.4,disagreement:-1.5,disagreements:-1.8,disagrees:-1.3,disappear:-.9,disappeared:-.9,disappears:-1.4,disappoint:-1.7,disappointed:-2.1,disappointedly:-1.7,disappointing:-2.2,disappointingly:-1.9,disappointment:-2.3,disappointments:-2,disappoints:-1.6,disaster:-3.1,disasters:-2.6,disastrous:-2.9,disbelieve:-1.2,discard:-1,discarded:-1.4,discarding:-.7,discards:-1,discomfort:-1.8,discomfortable:-1.6,discomforted:-1.6,discomforting:-1.6,discomforts:-1.3,disconsolate:-2.3,disconsolation:-1.7,discontented:-1.8,discord:-1.7,discounted:.2,discourage:-1.8,discourageable:-1.2,discouraged:-1.7,discouragement:-2,discouragements:-1.8,discourager:-1.7,discouragers:-1.9,discourages:-1.9,discouraging:-1.9,discouragingly:-1.8,discredited:-1.9,disdain:-2.1,disgrace:-2.2,disgraced:-2,disguise:-1,disguised:-1.1,disguises:-1,disguising:-1.3,disgust:-2.9,disgusted:-2.4,disgustedly:-3,disgustful:-2.6,disgusting:-2.4,disgustingly:-2.9,disgusts:-2.1,dishearten:-2,disheartened:-2.2,disheartening:-1.8,dishearteningly:-2,disheartenment:-2.3,disheartenments:-2.2,disheartens:-2.2,dishonest:-2.7,disillusion:-1,disillusioned:-1.9,disillusioning:-1.3,disillusionment:-1.7,disillusionments:-1.5,disillusions:-1.6,disinclined:-1.1,disjointed:-1.3,dislike:-1.6,disliked:-1.7,dislikes:-1.7,disliking:-1.3,dismal:-3,dismay:-1.8,dismayed:-1.9,dismaying:-2.2,dismayingly:-1.9,dismays:-1.8,disorder:-1.7,disorganized:-1.2,disoriented:-1.5,disparage:-2,disparaged:-1.4,disparages:-1.6,disparaging:-2.2,displeased:-1.9,dispute:-1.7,disputed:-1.4,disputes:-1.1,disputing:-1.7,disqualified:-1.8,disquiet:-1.3,disregard:-1.1,disregarded:-1.6,disregarding:-.9,disregards:-1.4,disrespect:-1.8,disrespected:-2,disruption:-1.5,disruptions:-1.4,disruptive:-1.3,dissatisfaction:-2.2,dissatisfactions:-1.9,dissatisfactory:-2,dissatisfied:-1.6,dissatisfies:-1.8,dissatisfy:-2.2,dissatisfying:-2.4,distort:-1.3,distorted:-1.7,distorting:-1.1,distorts:-1.4,distract:-1.2,distractable:-1.3,distracted:-1.4,distractedly:-.9,distractibility:-1.3,distractible:-1.5,distracting:-1.2,distractingly:-1.4,distraction:-1.6,distractions:-1,distractive:-1.6,distracts:-1.3,distraught:-2.6,distress:-2.4,distressed:-1.8,distresses:-1.6,distressful:-2.2,distressfully:-1.7,distressfulness:-2.4,distressing:-1.7,distressingly:-2.2,distrust:-1.8,distrusted:-2.4,distrustful:-2.1,distrustfully:-1.8,distrustfulness:-1.6,distrusting:-2.1,distrusts:-1.3,disturb:-1.7,disturbance:-1.6,disturbances:-1.4,disturbed:-1.6,disturber:-1.4,disturbers:-2.1,disturbing:-2.3,disturbingly:-2.3,disturbs:-1.9,dithering:-.5,divination:1.7,divinations:1.1,divinatory:1.6,divine:2.6,divined:.8,divinely:2.9,diviner:.3,diviners:1.2,divines:.8,divinest:2.7,diving:.3,divining:.9,divinise:.5,divinities:1.8,divinity:2.7,divinize:2.3,dizzy:-.9,dodging:-.4,dodgy:-.9,dolorous:-2.2,dominance:.8,dominances:-.1,dominantly:.2,dominants:.2,dominate:-.5,dominates:.2,dominating:-1.2,domination:-.2,dominations:-.3,dominative:-.7,dominators:-.4,dominatrices:-.2,dominatrix:-.5,dominatrixes:.6,doom:-1.7,doomed:-3.2,doomful:-2.1,dooming:-2.8,dooms:-1.1,doomsayer:-.7,doomsayers:-1.7,doomsaying:-1.5,doomsayings:-1.5,doomsday:-2.8,doomsdayer:-2.2,doomsdays:-2.4,doomster:-2.2,doomsters:-1.6,doomy:-1.1,dork:-1.4,dorkier:-1.1,dorkiest:-1.2,dorks:-.5,dorky:-1.1,doubt:-1.5,doubtable:-1.5,doubted:-1.1,doubter:-1.6,doubters:-1.3,doubtful:-1.4,doubtfully:-1.2,doubtfulness:-1.2,doubting:-1.4,doubtingly:-1.4,doubtless:.9,doubtlessly:1.2,doubtlessness:.8,doubts:-1.2,douche:-1.5,douchebag:-3,downcast:-1.8,downhearted:-2.3,downside:-1,drag:-.9,dragged:-.2,drags:-.7,drained:-1.5,dread:-2,dreaded:-2.7,dreadful:-1.9,dreadfully:-2.7,dreadfulness:-3.2,dreadfuls:-2.4,dreading:-2.4,dreadlock:-.4,dreadlocks:-.2,dreadnought:-.6,dreadnoughts:-.4,dreads:-1.4,dream:1,dreams:1.7,dreary:-1.4,droopy:-.8,drop:-1.1,drown:-2.7,drowned:-2.9,drowns:-2.2,drunk:-1.4,dubious:-1.5,dud:-1,dull:-1.7,dullard:-1.6,dullards:-1.8,dulled:-1.5,duller:-1.7,dullest:-1.7,dulling:-1.1,dullish:-1.1,dullness:-1.4,dullnesses:-1.9,dulls:-1,dullsville:-2.4,dully:-1.1,dumb:-2.3,dumbass:-2.6,dumbbell:-.8,dumbbells:-.2,dumbcane:-.3,dumbcanes:-.6,dumbed:-1.4,dumber:-1.5,dumbest:-2.3,dumbfound:-.1,dumbfounded:-1.6,dumbfounder:-1,dumbfounders:-1,dumbfounding:-.8,dumbfounds:-.3,dumbhead:-2.6,dumbheads:-1.9,dumbing:-.5,dumbly:-1.3,dumbness:-1.9,dumbs:-1.5,dumbstruck:-1,dumbwaiter:.2,dumbwaiters:-.1,dump:-1.6,dumpcart:-.6,dumped:-1.7,dumper:-1.2,dumpers:-.8,dumpier:-1.4,dumpiest:-1.6,dumpiness:-1.2,dumping:-1.3,dumpings:-1.1,dumpish:-1.8,dumpling:.4,dumplings:-.3,dumps:-1.7,dumpster:-.6,dumpsters:-1,dumpy:-1.7,dupe:-1.5,duped:-1.8,dwell:.5,dwelled:.4,dweller:.3,dwellers:-.3,dwelling:.1,dwells:-.1,dynamic:1.6,dynamical:1.2,dynamically:1.5,dynamics:1.1,dynamism:1.6,dynamisms:1.2,dynamist:1.4,dynamistic:1.5,dynamists:.9,dynamite:.7,dynamited:-.9,dynamiter:-1.2,dynamiters:.4,dynamites:-.3,dynamitic:.9,dynamiting:.2,dynamometer:.3,dynamometers:.3,dynamometric:.3,dynamometry:.6,dynamos:.3,dynamotor:.6,dysfunction:-1.8,eager:1.5,eagerly:1.6,eagerness:1.7,eagers:1.6,earnest:2.3,ease:1.5,eased:1.2,easeful:1.5,easefully:1.4,easel:.3,easement:1.6,easements:.4,eases:1.3,easier:1.8,easiest:1.8,easily:1.4,easiness:1.6,easing:1,easy:1.9,easygoing:1.3,easygoingness:1.5,ecstacy:3.3,ecstasies:2.3,ecstasy:2.9,ecstatic:2.3,ecstatically:2.8,ecstatics:2.9,eerie:-1.5,eery:-.9,effective:2.1,effectively:1.9,efficiencies:1.6,efficiency:1.5,efficient:1.8,efficiently:1.7,effin:-2.3,egotism:-1.4,egotisms:-1,egotist:-2.3,egotistic:-1.4,egotistical:-.9,egotistically:-1.8,egotists:-1.7,elated:3.2,elation:1.5,elegance:2.1,elegances:1.8,elegancies:1.6,elegancy:2.1,elegant:2.1,elegantly:1.9,embarrass:-1.2,embarrassable:-1.6,embarrassed:-1.5,embarrassedly:-1.1,embarrasses:-1.7,embarrassing:-1.6,embarrassingly:-1.7,embarrassment:-1.9,embarrassments:-1.7,embittered:-.4,embrace:1.3,emergency:-1.6,emotional:.6,empathetic:1.7,emptied:-.7,emptier:-.7,emptiers:-.7,empties:-.7,emptiest:-1.8,emptily:-1,emptiness:-1.9,emptinesses:-1.5,emptins:-.3,empty:-.8,emptying:-.6,enchanted:1.6,encourage:2.3,encouraged:1.5,encouragement:1.8,encouragements:2.1,encourager:1.5,encouragers:1.5,encourages:1.9,encouraging:2.4,encouragingly:2,endorse:1.3,endorsed:1,endorsement:1.3,endorses:1.4,enemies:-2.2,enemy:-2.5,energetic:1.9,energetically:1.8,energetics:.3,energies:.9,energise:2.2,energised:2.1,energises:2.2,energising:1.9,energization:1.6,energizations:1.5,energize:2.1,energized:2.3,energizer:2.1,energizers:1.7,energizes:2.1,energizing:2,energy:1.1,engage:1.4,engaged:1.7,engagement:2,engagements:.6,engager:1.1,engagers:1,engages:1,engaging:1.4,engagingly:1.5,engrossed:.6,enjoy:2.2,enjoyable:1.9,enjoyableness:1.9,enjoyably:1.8,enjoyed:2.3,enjoyer:2.2,enjoyers:2.2,enjoying:2.4,enjoyment:2.6,enjoyments:2,enjoys:2.3,enlighten:2.3,enlightened:2.2,enlightening:2.3,enlightens:1.7,ennui:-1.2,enrage:-2.6,enraged:-1.7,enrages:-1.8,enraging:-2.8,enrapture:3,enslave:-3.1,enslaved:-1.7,enslaves:-1.6,ensure:1.6,ensuring:1.1,enterprising:2.3,entertain:1.3,entertained:1.7,entertainer:1.6,entertainers:1,entertaining:1.9,entertainingly:1.9,entertainment:1.8,entertainments:2.3,entertains:2.4,enthral:.4,enthuse:1.6,enthused:2,enthuses:1.7,enthusiasm:1.9,enthusiasms:2,enthusiast:1.5,enthusiastic:2.2,enthusiastically:2.6,enthusiasts:1.4,enthusing:1.9,entitled:1.1,entrusted:.8,envied:-1.1,envier:-1,enviers:-1.1,envies:-.8,envious:-1.1,envy:-1.1,envying:-.8,envyingly:-1.3,erroneous:-1.8,error:-1.7,errors:-1.4,escape:.7,escapes:.5,escaping:.2,esteemed:1.9,ethical:2.3,euphoria:3.3,euphoric:3.2,eviction:-2,evil:-3.4,evildoer:-3.1,evildoers:-2.4,evildoing:-3.1,evildoings:-2.5,eviler:-2.1,evilest:-2.5,eviller:-2.9,evillest:-3.3,evilly:-3.4,evilness:-3.1,evils:-2.7,exaggerate:-.6,exaggerated:-.4,exaggerates:-.6,exaggerating:-.7,exasperated:-1.8,excel:2,excelled:2.2,excellence:3.1,excellences:2.5,excellencies:2.4,excellency:2.5,excellent:2.7,excellently:3.1,excelling:2.5,excels:2.5,excelsior:.7,excitabilities:1.5,excitability:1.2,excitable:1.5,excitableness:1,excitant:1.8,excitants:1.2,excitation:1.8,excitations:1.8,excitative:.3,excitatory:1.1,excite:2.1,excited:1.4,excitedly:2.3,excitement:2.2,excitements:1.9,exciter:1.9,exciters:1.4,excites:2.1,exciting:2.2,excitingly:1.9,exciton:.3,excitonic:.2,excitons:.8,excitor:.5,exclude:-.9,excluded:-1.4,exclusion:-1.2,exclusive:.5,excruciate:-2.7,excruciated:-1.3,excruciates:-1,excruciating:-3.3,excruciatingly:-2.9,excruciation:-3.4,excruciations:-1.9,excuse:.3,exempt:.4,exhaust:-1.2,exhausted:-1.5,exhauster:-1.3,exhausters:-1.3,exhaustibility:-.8,exhaustible:-1,exhausting:-1.5,exhaustion:-1.5,exhaustions:-1.1,exhaustive:-.5,exhaustively:-.7,exhaustiveness:-1.1,exhaustless:.2,exhaustlessness:.9,exhausts:-1.1,exhilarated:3,exhilarates:2.8,exhilarating:1.7,exonerate:1.8,exonerated:1.8,exonerates:1.6,exonerating:1,expand:1.3,expands:.4,expel:-1.9,expelled:-1,expelling:-1.6,expels:-1.6,exploit:-.4,exploited:-2,exploiting:-1.9,exploits:-1.4,exploration:.9,explorations:.3,expose:-.6,exposed:-.3,exposes:-.5,exposing:-1.1,extend:.7,extends:.5,exuberant:2.8,exultant:3,exultantly:1.4,fab:2,fabulous:2.4,fabulousness:2.8,fad:.9,fag:-2.1,faggot:-3.4,faggots:-3.2,fail:-2.5,failed:-2.3,failing:-2.3,failingly:-1.4,failings:-2.2,faille:.1,fails:-1.8,failure:-2.3,failures:-2,fainthearted:-.3,fair:1.3,faith:1.8,faithed:1.3,faithful:1.9,faithfully:1.8,faithfulness:1.9,faithless:-1,faithlessly:-.9,faithlessness:-1.8,faiths:1.8,fake:-2.1,fakes:-1.8,faking:-1.8,fallen:-1.5,falling:-.6,falsified:-1.6,falsify:-2,fame:1.9,fan:1.3,fantastic:2.6,fantastical:2,fantasticalities:2.1,fantasticality:1.7,fantasticalness:1.3,fantasticate:1.5,fantastico:.4,farce:-1.7,fascinate:2.4,fascinated:2.1,fascinates:2,fascination:2.2,fascinating:2.5,fascist:-2.6,fascists:-.8,fatal:-2.5,fatalism:-.6,fatalisms:-1.7,fatalist:-.5,fatalistic:-1,fatalists:-1.2,fatalities:-2.9,fatality:-3.5,fatally:-3.2,fatigue:-1,fatigued:-1.4,fatigues:-1.3,fatiguing:-1.2,fatiguingly:-1.5,fault:-1.7,faulted:-1.4,faultfinder:-.8,faultfinders:-1.5,faultfinding:-2.1,faultier:-2.1,faultiest:-2.1,faultily:-2,faultiness:-1.5,faulting:-1.4,faultless:2,faultlessly:2,faultlessness:1.1,faults:-2.1,faulty:-1.3,fav:2,fave:1.9,favor:1.7,favorable:2.1,favorableness:2.2,favorably:1.6,favored:1.8,favorer:1.3,favorers:1.4,favoring:1.8,favorite:2,favorited:1.7,favorites:1.8,favoritism:.7,favoritisms:.7,favors:1,favour:1.9,favoured:1.8,favourer:1.6,favourers:1.6,favouring:1.3,favours:1.8,fear:-2.2,feared:-2.2,fearful:-2.2,fearfuller:-2.2,fearfullest:-2.5,fearfully:-2.2,fearfulness:-1.8,fearing:-2.7,fearless:1.9,fearlessly:1.1,fearlessness:1.1,fears:-1.8,fearsome:-1.7,"fed up":-1.8,feeble:-1.2,feeling:.5,felonies:-2.5,felony:-2.5,ferocious:-.4,ferociously:-1.1,ferociousness:-1,ferocities:-1,ferocity:-.7,fervent:1.1,fervid:.5,festival:2.2,festivalgoer:1.3,festivalgoers:1.2,festivals:1.5,festive:2,festively:2.2,festiveness:2.4,festivities:2.1,festivity:2.2,feud:-1.4,feudal:-.8,feudalism:-.9,feudalisms:-.2,feudalist:-.9,feudalistic:-1.1,feudalities:-.4,feudality:-.5,feudalization:-.3,feudalize:-.5,feudalized:-.8,feudalizes:-.1,feudalizing:-.7,feudally:-.6,feudaries:-.3,feudary:-.8,feudatories:-.5,feudatory:-.1,feuded:-2.2,feuding:-1.6,feudist:-1.1,feudists:-.7,feuds:-1.4,fiasco:-2.3,fidgety:-1.4,fiery:-1.4,fiesta:2.1,fiestas:1.5,fight:-1.6,fighter:.6,fighters:-.2,fighting:-1.5,fightings:-1.9,fights:-1.7,fine:.8,fire:-1.4,fired:-2.6,firing:-1.4,fit:1.5,fitness:1.1,flagship:.4,flatter:.4,flattered:1.6,flatterer:-.3,flatterers:.3,flatteries:1.2,flattering:1.3,flatteringly:1,flatters:.6,flattery:.4,flawless:2.3,flawlessly:.8,flees:-.7,flexibilities:1,flexibility:1.4,flexible:.9,flexibly:1.3,flirtation:1.7,flirtations:-.1,flirtatious:.5,flirtatiously:-.1,flirtatiousness:.6,flirted:-.2,flirter:-.4,flirters:.6,flirtier:-.1,flirtiest:.4,flirting:.8,flirts:.7,flirty:.6,flop:-1.4,flops:-1.4,flu:-1.6,flunk:-1.3,flunked:-2.1,flunker:-1.9,flunkers:-1.6,flunkey:-1.8,flunkeys:-.6,flunkies:-1.4,flunking:-1.5,flunks:-1.8,flunky:-1.8,flustered:-1,focused:1.6,foe:-1.9,foehns:.2,foeman:-1.8,foemen:-.3,foes:-2,foetal:-.1,foetid:-2.3,foetor:-3,foetors:-2.1,foetus:.2,foetuses:.2,fond:1.9,fondly:1.9,fondness:2.5,fool:-1.9,fooled:-1.6,fooleries:-1.8,foolery:-1.8,foolfish:-.8,foolfishes:-.4,foolhardier:-1.5,foolhardiest:-1.3,foolhardily:-1,foolhardiness:-1.6,foolhardy:-1.4,fooling:-1.7,foolish:-1.1,foolisher:-1.7,foolishest:-1.4,foolishly:-1.8,foolishness:-1.8,foolishnesses:-2,foolproof:1.6,fools:-2.2,foolscaps:-.8,forbid:-1.3,forbiddance:-1.4,forbiddances:-1,forbidden:-1.8,forbidder:-1.6,forbidders:-1.5,forbidding:-1.9,forbiddingly:-1.9,forbids:-1.3,forced:-2,foreclosure:-.5,foreclosures:-2.4,forgave:1.4,forget:-.9,forgetful:-1.1,forgivable:1.7,forgivably:1.6,forgive:1.1,forgiven:1.6,forgiveness:1.1,forgiver:1.7,forgivers:1.2,forgives:1.7,forgiving:1.9,forgivingly:1.4,forgivingness:1.8,forgotten:-.9,fortunate:1.9,fought:-1.3,foughten:-1.9,frantic:-1.9,frantically:-1.4,franticness:-.7,fraud:-2.8,frauds:-2.3,fraudster:-2.5,fraudsters:-2.4,fraudulence:-2.3,fraudulent:-2.2,freak:-1.9,freaked:-1.2,freakier:-1.3,freakiest:-1.6,freakiness:-1.4,freaking:-1.8,freakish:-2.1,freakishly:-.8,freakishness:-1.4,freakout:-1.8,freakouts:-1.5,freaks:-.4,freaky:-1.5,free:2.3,freebase:-.1,freebased:.8,freebases:.8,freebasing:-.4,freebee:1.3,freebees:1.3,freebie:1.8,freebies:1.8,freeboard:.3,freeboards:.7,freeboot:-.7,freebooter:-1.7,freebooters:-.2,freebooting:-.8,freeborn:1.2,freed:1.7,freedman:1.1,freedmen:.7,freedom:3.2,freedoms:1.2,freedwoman:1.6,freedwomen:1.3,freeform:.9,freehand:.5,freehanded:1.4,freehearted:1.5,freehold:.7,freeholder:.5,freeholders:.1,freeholds:1,freeing:2.1,freelance:1.2,freelanced:.7,freelancer:1.1,freelancers:.4,freelances:.7,freelancing:.4,freeload:-1.9,freeloaded:-1.6,freeloader:-.7,freeloaders:-.1,freeloading:-1.3,freeloads:-1.3,freely:1.9,freeman:1.7,freemartin:-.5,freemasonries:.7,freemasonry:.3,freemen:1.5,freeness:1.6,freenesses:1.7,freer:1.1,freers:1,frees:1.2,freesia:.4,freesias:.4,freest:1.6,freestanding:1.1,freestyle:.7,freestyler:.4,freestylers:.8,freestyles:.3,freethinker:1,freethinkers:1,freethinking:1.1,freeware:.7,freeway:.2,freewheel:.5,freewheeled:.3,freewheeler:.2,freewheelers:-.3,freewheeling:.5,freewheelingly:.8,freewheels:.6,freewill:1,freewriting:.8,freeze:.2,freezers:-.1,freezes:-.1,freezing:-.4,freezingly:-1.6,frenzy:-1.3,fresh:1.3,friend:2.2,friended:1.7,friending:1.8,friendless:-1.5,friendlessness:-.3,friendlier:2,friendlies:2.2,friendliest:2.6,friendlily:1.8,friendliness:2,friendly:2.2,friends:2.1,friendship:1.9,friendships:1.6,fright:-1.6,frighted:-1.4,frighten:-1.4,frightened:-1.9,frightening:-2.2,frighteningly:-2.1,frightens:-1.7,frightful:-2.3,frightfully:-1.7,frightfulness:-1.9,frighting:-1.5,frights:-1.1,frisky:1,frowning:-1.4,frustrate:-2,frustrated:-2.4,frustrates:-1.9,frustrating:-1.9,frustratingly:-2,frustration:-2.1,frustrations:-2,fuck:-2.5,fucked:-3.4,fucker:-3.3,fuckers:-2.9,fuckface:-3.2,fuckhead:-3.1,fucks:-2.1,fucktard:-3.1,fud:-1.1,fuked:-2.5,fuking:-3.2,fulfill:1.9,fulfilled:1.8,fulfills:1,fume:-1.2,fumed:-1.8,fumeless:.3,fumelike:-.7,fumer:.7,fumers:-.8,fumes:-.1,fumet:.4,fumets:-.4,fumette:-.6,fuming:-2.7,fun:2.3,funeral:-1.5,funerals:-1.6,funky:-.4,funned:2.3,funnel:.1,funneled:.1,funnelform:.5,funneling:-.1,funnelled:-.1,funnelling:.1,funnels:.4,funner:2.2,funnest:2.9,funnier:1.7,funnies:1.3,funniest:2.6,funnily:1.9,funniness:1.8,funninesses:1.6,funning:1.8,funny:1.9,funnyman:1.4,funnymen:1.3,furious:-2.7,furiously:-1.9,fury:-2.7,futile:-1.9,gag:-1.4,gagged:-1.3,gain:2.4,gained:1.6,gaining:1.8,gains:1.4,gallant:1.7,gallantly:1.9,gallantry:2.6,geek:-.8,geekier:.2,geekiest:-.1,geeks:-.4,geeky:-.6,generosities:2.6,generosity:2.3,generous:2.3,generously:1.8,generousness:2.4,genial:1.8,gentle:1.9,gentler:1.4,gentlest:1.8,gently:2,ghost:-1.3,giddy:-.6,gift:1.9,giggle:1.8,giggled:1.5,giggler:.6,gigglers:1.4,giggles:.8,gigglier:1,giggliest:1.7,giggling:1.5,gigglingly:1.1,giggly:1,giver:1.4,givers:1.7,giving:1.4,glad:2,gladly:1.4,glamor:2.1,glamorise:1.3,glamorised:1.8,glamorises:2.1,glamorising:1.2,glamorization:1.6,glamorize:1.7,glamorized:2.1,glamorizer:2.4,glamorizers:1.6,glamorizes:2.4,glamorizing:1.8,glamorous:2.3,glamorously:2.1,glamors:1.4,glamour:2.4,glamourize:.8,glamourless:-1.6,glamourous:2,glamours:1.9,glee:3.2,gleeful:2.9,gloom:-2.6,gloomed:-1.9,gloomful:-2.1,gloomier:-1.5,gloomiest:-1.8,gloominess:-1.8,gloominesses:-1,glooming:-1.8,glooms:-.9,gloomy:-.6,gloried:2.4,glories:2.1,glorification:2,glorified:2.3,glorifier:2.3,glorifiers:1.6,glorifies:2.2,glorify:2.7,glorifying:2.4,gloriole:1.5,glorioles:1.2,glorious:3.2,gloriously:2.9,gloriousness:2.6,glory:2.5,glum:-2.1,gn8:.6,god:1.1,goddam:-2.5,goddammed:-2.4,goddamn:-2.1,goddamned:-1.8,goddamns:-2.1,goddams:-1.9,godsend:2.8,good:1.9,goodness:2,gorgeous:3,gorgeously:2.3,gorgeousness:2.9,gorgeousnesses:2.1,gossip:-.7,gossiped:-1.1,gossiper:-1.1,gossipers:-1.1,gossiping:-1.6,gossipmonger:-1,gossipmongers:-1.4,gossipped:-1.3,gossipping:-1.8,gossipries:-.8,gossipry:-1.2,gossips:-1.3,gossipy:-1.3,grace:1.8,graced:.9,graceful:2,gracefuller:2.2,gracefullest:2.8,gracefully:2.4,gracefulness:2.2,graces:1.6,gracile:1.7,graciles:.6,gracilis:.4,gracility:1.2,gracing:1.3,gracioso:1,gracious:2.6,graciously:2.3,graciousness:2.4,grand:2,grandee:1.1,grandees:1.2,grander:1.7,grandest:2.4,grandeur:2.4,grandeurs:2.1,grant:1.5,granted:1,granting:1.3,grants:.9,grateful:2,gratefuller:1.8,gratefully:2.1,gratefulness:2.2,graticule:.1,graticules:.2,gratification:1.6,gratifications:1.8,gratified:1.6,gratifies:1.5,gratify:1.3,gratifying:2.3,gratifyingly:2,gratin:.4,grating:-.4,gratingly:-.2,gratings:-.8,gratins:.2,gratis:.2,gratitude:2.3,gratz:2,grave:-1.6,graved:-.9,gravel:-.5,graveled:-.5,graveless:-1.3,graveling:-.4,gravelled:-.9,gravelling:-.4,gravelly:-.9,gravels:-.5,gravely:-1.5,graven:-.9,graveness:-1.5,graver:-1.1,gravers:-1.2,graves:-1.2,graveside:-.8,gravesides:-1.6,gravest:-1.3,gravestone:-.7,gravestones:-.5,graveyard:-1.2,graveyards:-1.2,great:3.1,greater:1.5,greatest:3.2,greed:-1.7,greedier:-2,greediest:-2.8,greedily:-1.9,greediness:-1.7,greeds:-1,greedy:-1.3,greenwash:-1.8,greenwashing:-.4,greet:1.3,greeted:1.1,greeting:1.6,greetings:1.8,greets:.6,grey:.2,grief:-2.2,grievance:-2.1,grievances:-1.5,grievant:-.8,grievants:-1.1,grieve:-1.6,grieved:-2,griever:-1.9,grievers:-.3,grieves:-2.1,grieving:-2.3,grievous:-2,grievously:-1.7,grievousness:-2.7,grim:-2.7,grimace:-1,grimaced:-2,grimaces:-1.8,grimacing:-1.4,grimalkin:-.9,grimalkins:-.9,grime:-1.5,grimed:-1.2,grimes:-1,grimier:-1.6,grimiest:-.7,grimily:-.7,griminess:-1.6,griming:-.7,grimly:-1.3,grimmer:-1.5,grimmest:-.8,grimness:-.8,grimy:-1.8,grin:2.1,grinned:1.1,grinner:1.1,grinners:1.6,grinning:1.5,grins:.9,gross:-2.1,grossed:-.4,grosser:-.3,grosses:-.8,grossest:-2.1,grossing:-.3,grossly:-.9,grossness:-1.8,grossular:-.3,grossularite:-.1,grossularites:-.7,grossulars:-.3,grouch:-2.2,grouched:-.8,grouches:-.9,grouchier:-2,grouchiest:-2.3,grouchily:-1.4,grouchiness:-2,grouching:-1.7,grouchy:-1.9,growing:.7,growth:1.6,guarantee:1,guilt:-1.1,guiltier:-2,guiltiest:-1.7,guiltily:-1.1,guiltiness:-1.8,guiltless:.8,guiltlessly:.7,guiltlessness:.6,guilts:-1.4,guilty:-1.8,gullibility:-1.6,gullible:-1.5,gun:-1.4,h8:-2.7,ha:1.4,hacked:-1.7,haha:2,hahaha:2.6,hahas:1.8,hail:.3,hailed:.9,hallelujah:3,handsome:2.2,handsomely:1.9,handsomeness:2.4,handsomer:2,handsomest:2.6,hapless:-1.4,haplessness:-1.4,happier:2.4,happiest:3.2,happily:2.6,happiness:2.6,happing:1.1,happy:2.7,harass:-2.2,harassed:-2.5,harasser:-2.4,harassers:-2.8,harasses:-2.5,harassing:-2.5,harassment:-2.5,harassments:-2.6,hard:-.4,hardier:-.6,hardship:-1.3,hardy:1.7,harm:-2.5,harmed:-2.1,harmfully:-2.6,harmfulness:-2.6,harming:-2.6,harmless:1,harmlessly:1.4,harmlessness:.8,harmonic:1.8,harmonica:.6,harmonically:2.1,harmonicas:.1,harmonicist:.5,harmonicists:.9,harmonics:1.5,harmonies:1.3,harmonious:2,harmoniously:1.9,harmoniousness:1.8,harmonise:1.8,harmonised:1.3,harmonising:1.4,harmonium:.9,harmoniums:.8,harmonization:1.9,harmonizations:.9,harmonize:1.7,harmonized:1.6,harmonizer:1.6,harmonizers:1.6,harmonizes:1.5,harmonizing:1.4,harmony:1.7,harms:-2.2,harried:-1.4,harsh:-1.9,harsher:-2.2,harshest:-2.9,hate:-2.7,hated:-3.2,hateful:-2.2,hatefully:-2.3,hatefulness:-3.6,hater:-1.8,haters:-2.2,hates:-1.9,hating:-2.3,hatred:-3.2,haunt:-1.7,haunted:-2.1,haunting:-1.1,haunts:-1,havoc:-2.9,healthy:1.7,heartbreak:-2.7,heartbreaker:-2.2,heartbreakers:-2.1,heartbreaking:-2,heartbreakingly:-1.8,heartbreaks:-1.8,heartbroken:-3.3,heartfelt:2.5,heartless:-2.2,heartlessly:-2.8,heartlessness:-2.8,heartwarming:2.1,heaven:2.3,heavenlier:3,heavenliest:2.7,heavenliness:2.7,heavenlinesses:2.3,heavenly:3,heavens:1.7,heavenward:1.4,heavenwards:1.2,heavyhearted:-2.1,heh:-.6,hell:-3.6,hellish:-3.2,help:1.7,helper:1.4,helpers:1.1,helpful:1.8,helpfully:2.3,helpfulness:1.9,helping:1.2,helpless:-2,helplessly:-1.4,helplessness:-2.1,helplessnesses:-1.7,helps:1.6,hero:2.6,heroes:2.3,heroic:2.6,heroical:2.9,heroically:2.4,heroicomic:1,heroicomical:1.1,heroics:2.4,heroin:-2.2,heroine:2.7,heroines:1.8,heroinism:-2,heroism:2.8,heroisms:2.2,heroize:2.1,heroized:2,heroizes:2.2,heroizing:1.9,heron:.1,heronries:.7,heronry:.1,herons:.5,heros:1.3,hesitance:-.9,hesitancies:-1,hesitancy:-.9,hesitant:-1,hesitantly:-1.2,hesitate:-1.1,hesitated:-1.3,hesitater:-1.4,hesitaters:-1.4,hesitates:-1.4,hesitating:-1.4,hesitatingly:-1.5,hesitation:-1.1,hesitations:-1.1,hid:-.4,hide:-.7,hides:-.7,hiding:-1.2,highlight:1.4,hilarious:1.7,hindrance:-1.7,hoax:-1.1,holiday:1.7,holidays:1.6,homesick:-.7,homesickness:-1.8,homesicknesses:-1.8,honest:2.3,honester:1.9,honestest:3,honesties:1.8,honestly:2,honesty:2.2,honor:2.2,honorability:2.2,honorable:2.5,honorableness:2.2,honorably:2.4,honoraria:.6,honoraries:1.5,honorarily:1.9,honorarium:.7,honorariums:1,honorary:1.4,honored:2.8,honoree:2.1,honorees:2.3,honorer:1.7,honorers:1.3,honorific:1.4,honorifically:2.2,honorifics:1.7,honoring:2.3,honors:2.3,honour:2.7,honourable:2.1,honoured:2.2,honourer:1.8,honourers:1.6,honouring:2.1,honours:2.2,hooligan:-1.5,hooliganism:-2.1,hooligans:-1.1,hooray:2.3,hope:1.9,hoped:1.6,hopeful:2.3,hopefully:1.7,hopefulness:1.6,hopeless:-2,hopelessly:-2.2,hopelessness:-3.1,hopes:1.8,hoping:1.8,horrendous:-2.8,horrendously:-1.9,horrent:-.9,horrible:-2.5,horribleness:-2.4,horribles:-2.1,horribly:-2.4,horrid:-2.5,horridly:-1.4,horridness:-2.3,horridnesses:-3,horrific:-3.4,horrifically:-2.9,horrified:-2.5,horrifies:-2.9,horrify:-2.5,horrifying:-2.7,horrifyingly:-3.3,horror:-2.7,horrors:-2.7,hostile:-1.6,hostilely:-2.2,hostiles:-1.3,hostilities:-2.1,hostility:-2.5,huckster:-.9,hug:2.1,huge:1.3,huggable:1.6,hugged:1.7,hugger:1.6,huggers:1.8,hugging:1.8,hugs:2.2,humerous:1.4,humiliate:-2.5,humiliated:-1.4,humiliates:-1,humiliating:-1.2,humiliatingly:-2.6,humiliation:-2.7,humiliations:-2.4,humor:1.1,humoral:.6,humored:1.2,humoresque:1.2,humoresques:.9,humoring:2.1,humorist:1.2,humoristic:1.5,humorists:1.3,humorless:-1.3,humorlessness:-1.4,humorous:1.6,humorously:2.3,humorousness:2.4,humors:1.6,humour:2.1,humoured:1.1,humouring:1.7,humourous:2,hunger:-1,hurrah:2.6,hurrahed:1.9,hurrahing:2.4,hurrahs:2.1,hurray:2.7,hurrayed:1.8,hurraying:1.2,hurrays:2.4,hurt:-2.4,hurter:-2.3,hurters:-1.9,hurtful:-2.4,hurtfully:-2.6,hurtfulness:-1.9,hurting:-1.7,hurtle:-.3,hurtled:-.6,hurtles:-1,hurtless:.3,hurtling:-1.4,hurts:-2.1,hypocritical:-2,hysteria:-1.9,hysterical:-.1,hysterics:-1.8,ideal:2.4,idealess:-1.9,idealise:1.4,idealised:2.1,idealises:2,idealising:.6,idealism:1.7,idealisms:.8,idealist:1.6,idealistic:1.8,idealistically:1.7,idealists:.7,idealities:1.5,ideality:1.9,idealization:1.8,idealizations:1.4,idealize:1.2,idealized:1.8,idealizer:1.3,idealizers:1.9,idealizes:2,idealizing:1.4,idealless:-1.7,ideally:1.8,idealogues:.5,idealogy:.8,ideals:.8,idiot:-2.3,idiotic:-2.6,ignorable:-1,ignorami:-1.9,ignoramus:-1.9,ignoramuses:-2.3,ignorance:-1.5,ignorances:-1.2,ignorant:-1.1,ignorantly:-1.6,ignorantness:-1.1,ignore:-1.5,ignored:-1.3,ignorer:-1.3,ignorers:-.7,ignores:-1.1,ignoring:-1.7,ill:-1.8,illegal:-2.6,illiteracy:-1.9,illness:-1.7,illnesses:-2.2,imbecile:-2.2,immobilized:-1.2,immoral:-2,immoralism:-1.6,immoralist:-2.1,immoralists:-1.7,immoralities:-1.1,immorality:-.6,immorally:-2.1,immortal:1,immune:1.2,impatience:-1.8,impatiens:-.2,impatient:-1.2,impatiently:-1.7,imperfect:-1.3,impersonal:-1.3,impolite:-1.6,impolitely:-1.8,impoliteness:-1.8,impolitenesses:-2.3,importance:1.5,importancies:.4,importancy:1.4,important:.8,importantly:1.3,impose:-1.2,imposed:-.3,imposes:-.4,imposing:-.4,impotent:-1.1,impress:1.9,impressed:2.1,impresses:2.1,impressibility:1.2,impressible:.8,impressing:2.5,impression:.9,impressionable:.2,impressionism:.8,impressionisms:.5,impressionist:1,impressionistic:1.5,impressionistically:1.6,impressionists:.5,impressions:.9,impressive:2.3,impressively:2,impressiveness:1.7,impressment:-.4,impressments:.5,impressure:.6,imprisoned:-2,improve:1.9,improved:2.1,improvement:2,improvements:1.3,improver:1.8,improvers:1.3,improves:1.8,improving:1.8,inability:-1.7,inaction:-1,inadequacies:-1.7,inadequacy:-1.7,inadequate:-1.7,inadequately:-1,inadequateness:-1.7,inadequatenesses:-1.6,incapable:-1.6,incapacitated:-1.9,incensed:-2,incentive:1.5,incentives:1.3,incompetence:-2.3,incompetent:-2.1,inconsiderate:-1.9,inconvenience:-1.5,inconvenient:-1.4,increase:1.3,increased:1.1,indecision:-.8,indecisions:-1.1,indecisive:-1,indecisively:-.7,indecisiveness:-1.3,indecisivenesses:-.9,indestructible:.6,indifference:-.2,indifferent:-.8,indignant:-1.8,indignation:-2.4,indoctrinate:-1.4,indoctrinated:-.4,indoctrinates:-.6,indoctrinating:-.7,ineffective:-.5,ineffectively:-1.3,ineffectiveness:-1.3,ineffectual:-1.2,ineffectuality:-1.6,ineffectually:-1.1,ineffectualness:-1.3,infatuated:.2,infatuation:.6,infected:-2.2,inferior:-1.7,inferiorities:-1.9,inferiority:-1.1,inferiorly:-2,inferiors:-.5,inflamed:-1.4,influential:1.9,infringement:-2.1,infuriate:-2.2,infuriated:-3,infuriates:-2.6,infuriating:-2.4,inhibin:-.2,inhibit:-1.6,inhibited:-.4,inhibiting:-.4,inhibition:-1.5,inhibitions:-.8,inhibitive:-1.4,inhibitor:-.3,inhibitors:-1,inhibitory:-1,inhibits:-.9,injured:-1.7,injury:-1.8,injustice:-2.7,innocence:1.6,innocency:1.9,innocent:1.4,innocenter:.9,innocently:1.4,innocents:1.1,innovate:2.2,innovates:2,innovation:1.6,innovative:1.9,inquisition:-1.2,inquisitive:.7,insane:-1.7,insanity:-2.7,insecure:-1.8,insecurely:-1.4,insecureness:-1.8,insecurities:-1.8,insecurity:-1.8,insensitive:-.9,insensitivity:-1.8,insignificant:-1.4,insincere:-1.8,insincerely:-1.9,insincerity:-1.4,insipid:-2,inspiration:2.4,inspirational:2.3,inspirationally:2.3,inspirations:2.1,inspirator:1.9,inspirators:1.2,inspiratory:1.5,inspire:2.7,inspired:2.2,inspirer:2.2,inspirers:2,inspires:1.9,inspiring:1.8,inspiringly:2.6,inspirit:1.9,inspirited:1.3,inspiriting:1.8,inspiritingly:2.1,inspirits:.8,insult:-2.3,insulted:-2.3,insulter:-2,insulters:-2,insulting:-2.2,insultingly:-2.3,insults:-1.8,intact:.8,integrity:1.6,intellect:2,intellection:.6,intellections:.8,intellective:1.7,intellectively:.8,intellects:1.8,intellectual:2.3,intellectualism:2.2,intellectualist:2,intellectualistic:1.3,intellectualists:.8,intellectualities:1.7,intellectuality:1.7,intellectualization:1.5,intellectualize:1.5,intellectualized:1.2,intellectualizes:1.8,intellectualizing:.8,intellectually:1.4,intellectualness:1.5,intellectuals:1.6,intelligence:2.1,intelligencer:1.5,intelligencers:1.6,intelligences:1.6,intelligent:2,intelligential:1.9,intelligently:2,intelligentsia:1.5,intelligibility:1.5,intelligible:1.4,intelligibleness:1.5,intelligibly:1.2,intense:.3,interest:2,interested:1.7,interestedly:1.5,interesting:1.7,interestingly:1.7,interestingness:1.8,interests:1,interrogated:-1.6,interrupt:-1.4,interrupted:-1.2,interrupter:-1.1,interrupters:-1.3,interruptible:-1.3,interrupting:-1.2,interruption:-1.5,interruptions:-1.7,interruptive:-1.4,interruptor:-1.3,interrupts:-1.3,intimidate:-.8,intimidated:-1.9,intimidates:-1.3,intimidating:-1.9,intimidatingly:-1.1,intimidation:-1.8,intimidations:-1.4,intimidator:-1.6,intimidators:-1.6,intimidatory:-1.1,intricate:.6,intrigues:.9,invigorate:1.9,invigorated:.8,invigorates:2.1,invigorating:2.1,invigoratingly:2,invigoration:1.5,invigorations:1.2,invigorator:1.1,invigorators:1.2,invincible:2.2,invite:.6,inviting:1.3,invulnerable:1.3,irate:-2.9,ironic:-.5,irony:-.2,irrational:-1.4,irrationalism:-1.5,irrationalist:-2.1,irrationalists:-1.5,irrationalities:-1.5,irrationality:-1.7,irrationally:-1.6,irrationals:-1.1,irresistible:1.4,irresolute:-1.4,irresponsible:-1.9,irreversible:-.8,irritabilities:-1.7,irritability:-1.4,irritable:-2.1,irritableness:-1.7,irritably:-1.8,irritant:-2.3,irritants:-2.1,irritate:-1.8,irritated:-2,irritates:-1.7,irritating:-2,irritatingly:-2,irritation:-2.3,irritations:-1.5,irritative:-2,isolatable:.2,isolate:-.8,isolated:-1.3,isolates:-1.3,isolation:-1.7,isolationism:.4,isolationist:.7,isolations:-.5,isolator:-.4,isolators:-.4,itchy:-1.1,jackass:-1.8,jackasses:-2.8,jaded:-1.6,jailed:-2.2,jaunty:1.2,jealous:-2,jealousies:-2,jealously:-2,jealousness:-1.7,jealousy:-1.3,jeopardy:-2.1,jerk:-1.4,jerked:-.8,jerks:-1.1,jewel:1.5,jewels:2,jocular:1.2,join:1.2,joke:1.2,joked:1.3,joker:.5,jokes:1,jokester:1.5,jokesters:.9,jokey:1.1,joking:.9,jollied:2.4,jollier:2.4,jollies:2,jolliest:2.9,jollification:2.2,jollifications:2,jollify:2.1,jollily:2.7,jolliness:2.5,jollities:1.7,jollity:1.8,jolly:2.3,jollying:2.3,jovial:1.9,joy:2.8,joyance:2.3,joyed:2.9,joyful:2.9,joyfuller:2.4,joyfully:2.5,joyfulness:2.7,joying:2.5,joyless:-2.5,joylessly:-1.7,joylessness:-2.7,joyous:3.1,joyously:2.9,joyousness:2.8,joypop:-.2,joypoppers:-.1,joyridden:.6,joyride:1.1,joyrider:.7,joyriders:1.3,joyrides:.8,joyriding:.9,joyrode:1,joys:2.2,joystick:.7,joysticks:.2,jubilant:3,jumpy:-1,justice:2.4,justifiably:1,justified:1.7,keen:1.5,keened:.3,keener:.5,keeners:.6,keenest:1.9,keening:-.7,keenly:1,keenness:1.4,keens:.1,kewl:1.3,kidding:.4,kill:-3.7,killdeer:-1.1,killdeers:-.1,killdees:-.6,killed:-3.5,killer:-3.3,killers:-3.3,killick:.1,killie:-.1,killifish:-.1,killifishes:-.1,killing:-3.4,killingly:-2.6,killings:-3.5,killjoy:-2.1,killjoys:-1.7,killock:-.3,killocks:-.4,kills:-2.5,kind:2.4,kinder:2.2,kindly:2.2,kindness:2,kindnesses:2.3,kiss:1.8,kissable:2,kissably:1.9,kissed:1.6,kisser:1.7,kissers:1.5,kisses:2.3,kissing:2.7,kissy:1.8,kudos:2.3,lack:-1.3,lackadaisical:-1.6,lag:-1.4,lagged:-1.2,lagging:-1.1,lags:-1.5,laidback:.5,lame:-1.8,lamebrain:-1.6,lamebrained:-2.5,lamebrains:-1.2,lamedh:.1,lamella:-.1,lamellae:-.1,lamellas:.1,lamellibranch:.2,lamellibranchs:-.1,lamely:-2,lameness:-.8,lament:-2,lamentable:-1.5,lamentableness:-1.3,lamentably:-1.5,lamentation:-1.4,lamentations:-1.9,lamented:-1.4,lamenter:-1.2,lamenters:-.5,lamenting:-2,laments:-1.5,lamer:-1.4,lames:-1.2,lamest:-1.5,landmark:.3,laugh:2.6,laughable:.2,laughableness:1.2,laughably:1.2,laughed:2,laugher:1.7,laughers:1.7,laughing:2.2,laughingly:2.3,laughings:1.9,laughingstocks:-1.3,laughs:2.2,laughter:2.2,laughters:2.2,launched:.5,lawl:1.4,lawsuit:-.9,lawsuits:-.6,lazier:-2.3,laziest:-2.7,lazy:-1.5,leak:-1.4,leaked:-1.3,leave:-.2,leet:1.3,legal:.5,legally:.4,lenient:1.1,lethargic:-1.2,lethargy:-1.4,liabilities:-.8,liability:-.8,liar:-2.3,liards:-.4,liars:-2.4,libelous:-2.1,libertarian:.9,libertarianism:.4,libertarianisms:.1,libertarians:.1,liberties:2.3,libertinage:.2,libertine:-.9,libertines:.4,libertinisms:1.2,liberty:2.4,lied:-1.6,lies:-1.8,lifesaver:2.8,lighthearted:1.8,like:1.5,likeable:2,liked:1.8,likes:1.8,liking:1.7,limitation:-1.2,limited:-.9,litigation:-.8,litigious:-.8,livelier:1.7,liveliest:2.1,livelihood:.8,livelihoods:.9,livelily:1.8,liveliness:1.6,livelong:1.7,lively:1.9,livid:-2.5,lmao:2.9,loathe:-2.2,loathed:-2.1,loathes:-1.9,loathing:-2.7,lobby:.1,lobbying:-.3,lol:1.8,lone:-1.1,lonelier:-1.4,loneliest:-2.4,loneliness:-1.8,lonelinesses:-1.5,lonely:-1.5,loneness:-1.1,loner:-1.3,loners:-.9,lonesome:-1.5,lonesomely:-1.3,lonesomeness:-1.8,lonesomes:-1.4,longing:-.1,longingly:.7,longings:.4,loom:-.9,loomed:-1.1,looming:-.5,looms:-.6,loose:-1.3,looses:-.6,lose:-1.7,loser:-2.4,losers:-2.4,loses:-1.3,losing:-1.6,loss:-1.3,losses:-1.7,lossy:-1.2,lost:-1.3,louse:-1.6,loused:-1,louses:-1.3,lousewort:.1,louseworts:-.6,lousier:-2.2,lousiest:-2.6,lousily:-1.2,lousiness:-1.7,lousing:-1.1,lousy:-2.5,lovable:3,love:3.2,loved:2.9,lovelies:2.2,lovely:2.8,lover:2.8,loverly:2.8,lovers:2.4,loves:2.7,loving:2.9,lovingly:3.2,lovingness:2.7,low:-1.1,lowball:-.8,lowballed:-1.5,lowballing:-.7,lowballs:-1.2,lowborn:-.7,lowboys:-.6,lowbred:-2.6,lowbrow:-1.9,lowbrows:-.6,lowdown:-.8,lowdowns:-.2,lowe:.5,lowed:-.8,lower:-1.2,lowercase:.3,lowercased:-.2,lowerclassman:-.4,lowered:-.5,lowering:-1,lowermost:-1.4,lowers:-.5,lowery:-1.8,lowest:-1.6,lowing:-.5,lowish:-.9,lowland:-.1,lowlander:-.4,lowlanders:-.3,lowlands:-.1,lowlier:-1.7,lowliest:-1.8,lowlife:-1.5,lowlifes:-2.2,lowlight:-2,lowlights:-.3,lowlihead:-.3,lowliness:-1.1,lowlinesses:-1.2,lowlives:-2.1,lowly:-1,lown:.9,lowness:-1.3,lowrider:-.2,lowriders:.1,lows:-.8,lowse:-.7,loyal:2.1,loyalism:1,loyalisms:.9,loyalist:1.5,loyalists:1.1,loyally:2.1,loyalties:1.9,loyalty:2.5,luck:2,lucked:1.9,luckie:1.6,luckier:1.9,luckiest:2.9,luckily:2.3,luckiness:1,lucking:1.2,luckless:-1.3,lucks:1.6,lucky:1.8,ludicrous:-1.5,ludicrously:-.2,ludicrousness:-1.9,lugubrious:-2.1,lulz:2,lunatic:-2.2,lunatics:-1.6,lurk:-.8,lurking:-.5,lurks:-.9,lying:-2.4,mad:-2.2,maddening:-2.2,madder:-1.2,maddest:-2.8,madly:-1.7,madness:-1.9,magnific:2.3,magnifical:2.4,magnifically:2.4,magnification:1,magnifications:1.2,magnificence:2.4,magnificences:2.3,magnificent:2.9,magnificently:3.4,magnifico:1.8,magnificoes:1.4,mandatory:.3,maniac:-2.1,maniacal:-.3,maniacally:-1.7,maniacs:-1.2,manipulated:-1.6,manipulating:-1.5,manipulation:-1.2,marvel:1.8,marvelous:2.9,marvels:2,masochism:-1.6,masochisms:-1.1,masochist:-1.7,masochistic:-2.2,masochistically:-1.6,masochists:-1.2,masterpiece:3.1,masterpieces:2.5,matter:.1,matters:.1,mature:1.8,meaningful:1.3,meaningless:-1.9,medal:2.1,mediocrity:-.3,meditative:1.4,meh:-.3,melancholia:-.5,melancholiac:-2,melancholias:-1.6,melancholic:-.3,melancholics:-1,melancholies:-1.1,melancholy:-1.9,menace:-2.2,menaced:-1.7,mercy:1.5,merit:1.8,merited:1.4,meriting:1.1,meritocracy:.6,meritocrat:.4,meritocrats:1.1,meritorious:2.1,meritoriously:1.3,meritoriousness:1.7,merits:1.7,merrier:1.7,merriest:2.7,merrily:2.4,merriment:2.4,merriments:2,merriness:2.2,merry:2.5,merrymaker:2.2,merrymakers:1.7,merrymaking:2.2,merrymakings:2.4,merrythought:1.1,merrythoughts:1.6,mess:-1.5,messed:-1.4,messy:-1.5,methodical:.6,mindless:-1.9,miracle:2.8,mirth:2.6,mirthful:2.7,mirthfully:2,misbehave:-1.9,misbehaved:-1.6,misbehaves:-1.6,misbehaving:-1.7,mischief:-1.5,mischiefs:-.8,miser:-1.8,miserable:-2.2,miserableness:-2.8,miserably:-2.1,miserere:-.8,misericorde:.1,misericordes:-.5,miseries:-2.7,miserliness:-2.6,miserly:-1.4,misers:-1.5,misery:-2.7,misgiving:-1.4,misinformation:-1.3,misinformed:-1.6,misinterpreted:-1.3,misleading:-1.7,misread:-1.1,misreporting:-1.5,misrepresentation:-2,miss:-.6,missed:-1.2,misses:-.9,missing:-1.2,mistakable:-.8,mistake:-1.4,mistaken:-1.5,mistakenly:-1.2,mistaker:-1.6,mistakers:-1.6,mistakes:-1.5,mistaking:-1.1,misunderstand:-1.5,misunderstanding:-1.8,misunderstands:-1.3,misunderstood:-1.4,mlm:-1.4,mmk:.6,moan:-.6,moaned:-.4,moaning:-.4,moans:-.6,mock:-1.8,mocked:-1.3,mocker:-.8,mockeries:-1.6,mockers:-1.3,mockery:-1.3,mocking:-1.7,mocks:-2,molest:-2.1,molestation:-1.9,molestations:-2.9,molested:-1.9,molester:-2.3,molesters:-2.2,molesting:-2.8,molests:-3.1,mongering:-.8,monopolize:-.8,monopolized:-.9,monopolizes:-1.1,monopolizing:-.5,mooch:-1.7,mooched:-1.4,moocher:-1.5,moochers:-1.9,mooches:-1.4,mooching:-1.7,moodier:-1.1,moodiest:-2.1,moodily:-1.3,moodiness:-1.4,moodinesses:-1.4,moody:-1.5,mope:-1.9,moping:-1,moron:-2.2,moronic:-2.7,moronically:-1.4,moronity:-1.1,morons:-1.3,motherfucker:-3.6,motherfucking:-2.8,motivate:1.6,motivated:2,motivating:2.2,motivation:1.4,mourn:-1.8,mourned:-1.3,mourner:-1.6,mourners:-1.8,mournful:-1.6,mournfuller:-1.9,mournfully:-1.7,mournfulness:-1.8,mourning:-1.9,mourningly:-2.3,mourns:-2.4,muah:2.3,mumpish:-1.4,murder:-3.7,murdered:-3.4,murderee:-3.2,murderees:-3.1,murderer:-3.6,murderers:-3.3,murderess:-2.2,murderesses:-2.6,murdering:-3.3,murderous:-3.2,murderously:-3.1,murderousness:-2.9,murders:-3,n00b:-1.6,nag:-1.5,nagana:-1.7,nagged:-1.7,nagger:-1.8,naggers:-1.5,naggier:-1.4,naggiest:-2.4,nagging:-1.7,naggingly:-.9,naggy:-1.7,nags:-1.1,nah:-.4,naive:-1.1,nastic:.2,nastier:-2.3,nasties:-2.1,nastiest:-2.4,nastily:-1.9,nastiness:-1.1,nastinesses:-2.6,nasturtium:.4,nasturtiums:.1,nasty:-2.6,natural:1.5,neat:2,neaten:1.2,neatened:2,neatening:1.3,neatens:1.1,neater:1,neatest:1.7,neath:.2,neatherd:-.4,neatly:1.4,neatness:1.3,neats:1.1,needy:-1.4,negative:-2.7,negativity:-2.3,neglect:-2,neglected:-2.4,neglecter:-1.7,neglecters:-1.5,neglectful:-2,neglectfully:-2.1,neglectfulness:-2,neglecting:-1.7,neglects:-2.2,nerd:-1.2,nerdier:-.2,nerdiest:.6,nerdish:-.1,nerdy:-.2,nerves:-.4,nervous:-1.1,nervously:-.6,nervousness:-1.2,neurotic:-1.4,neurotically:-1.8,neuroticism:-.9,neurotics:-.7,nice:1.8,nicely:1.9,niceness:1.6,nicenesses:2.1,nicer:1.9,nicest:2.2,niceties:1.5,nicety:1.2,nifty:1.7,niggas:-1.4,nigger:-3.3,no:-1.2,noble:2,noisy:-.7,nonsense:-1.7,noob:-.2,nosey:-.8,notorious:-1.9,novel:1.3,numb:-1.4,numbat:.2,numbed:-.9,number:.3,numberable:.6,numbest:-1,numbfish:-.4,numbfishes:-.7,numbing:-1.1,numbingly:-1.3,numbles:.4,numbly:-1.4,numbness:-1.1,numbs:-.7,numbskull:-2.3,numbskulls:-2.2,nurtural:1.5,nurturance:1.6,nurturances:1.3,nurturant:1.7,nurture:1.4,nurtured:1.9,nurturer:1.9,nurturers:.8,nurtures:1.9,nurturing:2,nuts:-1.3,"o.o":-.8,"o/\\o":2.1,o_0:-.1,obliterate:-2.9,obliterated:-2.1,obnoxious:-2,obnoxiously:-2.3,obnoxiousness:-2.1,obscene:-2.8,obsess:-1,obsessed:-.7,obsesses:-1,obsessing:-1.4,obsession:-1.4,obsessional:-1.5,obsessionally:-1.3,obsessions:-.9,obsessive:-.9,obsessively:-.4,obsessiveness:-1.2,obsessives:-.7,obsolete:-1.2,obstacle:-1.5,obstacles:-1.6,obstinate:-1.2,odd:-1.3,offence:-1.2,offences:-1.4,offend:-1.2,offended:-1,offender:-1.5,offenders:-1.5,offending:-2.3,offends:-2,offense:-1,offenseless:.7,offenses:-1.5,offensive:-2,offensively:-2.8,offensiveness:-2.3,offensives:-.8,offline:-.5,ok:1.2,okay:.9,okays:2.1,ominous:-1.4,"once-in-a-lifetime":1.8,openness:1.4,opportune:1.7,opportunely:1.5,opportuneness:1.2,opportunism:.4,opportunisms:.2,opportunist:.2,opportunistic:-.1,opportunistically:.9,opportunists:.3,opportunities:1.6,opportunity:1.8,oppressed:-2.1,oppressive:-1.7,optimal:1.5,optimality:1.9,optimally:1.3,optimisation:1.6,optimisations:1.8,optimise:1.9,optimised:1.7,optimises:1.6,optimising:1.7,optimism:2.5,optimisms:2,optimist:2.4,optimistic:1.3,optimistically:2.1,optimists:1.6,optimization:1.6,optimizations:.9,optimize:2.2,optimized:2,optimizer:1.5,optimizers:2.1,optimizes:1.8,optimizing:2,optionless:-1.7,original:1.3,outcry:-2.3,outgoing:1.2,outmaneuvered:.5,outrage:-2.3,outraged:-2.5,outrageous:-2,outrageously:-1.2,outrageousness:-1.2,outrageousnesses:-1.3,outrages:-2.3,outraging:-2,outreach:1.1,outstanding:3,overjoyed:2.7,overload:-1.5,overlooked:-.1,overreact:-1,overreacted:-1.7,overreaction:-.7,overreacts:-2.2,oversell:-.9,overselling:-.8,oversells:.3,oversimplification:.2,oversimplifies:.1,oversimplify:-.6,overstatement:-1.1,overstatements:-.7,overweight:-1.5,overwhelm:-.7,overwhelmed:.2,overwhelmingly:-.5,overwhelms:-.8,oxymoron:-.5,pain:-2.3,pained:-1.8,painful:-1.9,painfuller:-1.7,painfully:-2.4,painfulness:-2.7,paining:-1.7,painless:1.2,painlessly:1.1,painlessness:.4,pains:-1.8,palatable:1.6,palatableness:.8,palatably:1.1,panic:-2.3,panicked:-2,panicking:-1.9,panicky:-1.5,panicle:.5,panicled:.1,panicles:-.2,panics:-1.9,paniculate:.1,panicums:-.1,paradise:3.2,paradox:-.4,paranoia:-1,paranoiac:-1.3,paranoiacs:-.7,paranoias:-1.5,paranoid:-1,paranoids:-1.6,pardon:1.3,pardoned:.9,pardoning:1.7,pardons:1.2,parley:-.4,partied:1.4,partier:1.4,partiers:.7,parties:1.7,party:1.7,partyer:1.2,partyers:1.1,partying:1.6,passion:2,passional:1.6,passionate:2.4,passionately:2.4,passionateness:2.3,passionflower:.3,passionflowers:.4,passionless:-1.9,passions:2.2,passive:.8,passively:-.7,pathetic:-2.7,pathetical:-1.2,pathetically:-1.8,pay:-.4,peace:2.5,peaceable:1.7,peaceableness:1.8,peaceably:2,peaceful:2.2,peacefuller:1.9,peacefullest:3.1,peacefully:2.4,peacefulness:2.1,peacekeeper:1.6,peacekeepers:1.6,peacekeeping:2,peacekeepings:1.6,peacemaker:2,peacemakers:2.4,peacemaking:1.7,peacenik:.8,peaceniks:.7,peaces:2.1,peacetime:2.2,peacetimes:2.1,peculiar:.6,peculiarities:.1,peculiarity:.6,peculiarly:-.4,penalty:-2,pensive:.3,perfect:2.7,perfecta:1.4,perfectas:.6,perfected:2.7,perfecter:1.8,perfecters:1.4,perfectest:3.1,perfectibilities:2.1,perfectibility:1.8,perfectible:1.5,perfecting:2.3,perfection:2.7,perfectionism:1.3,perfectionist:1.5,perfectionistic:.7,perfectionists:.1,perfections:2.5,perfective:1.2,perfectively:2.1,perfectiveness:.9,perfectives:.9,perfectivity:2.2,perfectly:3.2,perfectness:3,perfecto:1.3,perfects:1.6,peril:-1.7,perjury:-1.9,perpetrator:-2.2,perpetrators:-1,perplexed:-1.3,persecute:-2.1,persecuted:-1.3,persecutes:-1.2,persecuting:-1.5,perturbed:-1.4,perverse:-1.8,perversely:-2.2,perverseness:-2.1,perversenesses:-.5,perversion:-1.3,perversions:-1.2,perversities:-1.1,perversity:-2.6,perversive:-2.1,pervert:-2.3,perverted:-2.5,pervertedly:-1.2,pervertedness:-1.2,perverter:-1.7,perverters:-.6,perverting:-1,perverts:-2.8,pesky:-1.2,pessimism:-1.5,pessimisms:-2,pessimist:-1.5,pessimistic:-1.5,pessimistically:-2,pessimists:-1,petrifaction:-1.9,petrifactions:-.3,petrification:-.1,petrifications:-.4,petrified:-2.5,petrifies:-2.3,petrify:-1.7,petrifying:-2.6,pettier:-.3,pettiest:-1.3,petty:-.8,phobia:-1.6,phobias:-2,phobic:-1.2,phobics:-1.3,picturesque:1.6,pileup:-1.1,pique:-1.1,piqued:.1,piss:-1.7,pissant:-1.5,pissants:-2.5,pissed:-3.2,pisser:-2,pissers:-1.4,pisses:-1.4,pissing:-1.7,pissoir:-.8,piteous:-1.2,pitiable:-1.1,pitiableness:-1.1,pitiably:-1.1,pitied:-1.3,pitier:-1.2,pitiers:-1.3,pities:-1.2,pitiful:-2.2,pitifuller:-1.8,pitifullest:-1.1,pitifully:-1.2,pitifulness:-1.2,pitiless:-1.8,pitilessly:-2.1,pitilessness:-.5,pity:-1.2,pitying:-1.4,pityingly:-1,pityriasis:-.8,play:1.4,played:1.4,playful:1.9,playfully:1.6,playfulness:1.2,playing:.8,plays:1,pleasant:2.3,pleasanter:1.5,pleasantest:2.6,pleasantly:2.1,pleasantness:2.3,pleasantnesses:2.3,pleasantries:1.3,pleasantry:2,please:1.3,pleased:1.9,pleaser:1.7,pleasers:1,pleases:1.7,pleasing:2.4,pleasurability:1.9,pleasurable:2.4,pleasurableness:2.4,pleasurably:2.6,pleasure:2.7,pleasured:2.3,pleasureless:-1.6,pleasures:1.9,pleasuring:2.8,poised:1,poison:-2.5,poisoned:-2.2,poisoner:-2.7,poisoners:-3.1,poisoning:-2.8,poisonings:-2.4,poisonous:-2.7,poisonously:-2.9,poisons:-2.7,poisonwood:-1,pollute:-2.3,polluted:-2,polluter:-1.8,polluters:-2,pollutes:-2.2,poor:-2.1,poorer:-1.5,poorest:-2.5,popular:1.8,popularise:1.6,popularised:1.1,popularises:.5,popularising:1.2,popularities:1.6,popularity:2.1,popularization:1.3,popularizations:.9,popularize:1.3,popularized:1.9,popularizer:1.8,popularizers:1,popularizes:1.4,popularizing:1.5,popularly:1.8,positive:2.6,positively:2.4,positiveness:2.3,positivenesses:2.2,positiver:2.3,positives:2.4,positivest:2.9,positivism:1.6,positivisms:1.8,positivist:2,positivistic:1.9,positivists:1.7,positivities:2.6,positivity:2.3,possessive:-.9,postpone:-.9,postponed:-.8,postpones:-1.1,postponing:-.5,poverty:-2.3,powerful:1.8,powerless:-2.2,praise:2.6,praised:2.2,praiser:2,praisers:2,praises:2.4,praiseworthily:1.9,praiseworthiness:2.4,praiseworthy:2.6,praising:2.5,pray:1.3,praying:1.5,prays:1.4,prblm:-1.6,prblms:-2.3,precious:2.7,preciously:2.2,preciousness:1.9,prejudice:-2.3,prejudiced:-1.9,prejudices:-1.8,prejudicial:-2.6,prejudicially:-1.5,prejudicialness:-2.4,prejudicing:-1.8,prepared:.9,pressure:-1.2,pressured:-.9,pressureless:1,pressures:-1.3,pressuring:-1.4,pressurise:-.6,pressurised:-.4,pressurises:-.8,pressurising:-.6,pressurizations:-.3,pressurize:-.7,pressurized:.1,pressurizer:.1,pressurizers:-.7,pressurizes:-.2,pressurizing:-.2,pretend:-.4,pretending:.4,pretends:-.4,prettied:1.6,prettier:2.1,pretties:1.7,prettiest:2.7,pretty:2.2,prevent:.1,prevented:.1,preventing:-.1,prevents:.3,prick:-1.4,pricked:-.6,pricker:-.3,prickers:-.2,pricket:-.5,prickets:.3,pricking:-.9,prickle:-1,prickled:-.2,prickles:-.8,pricklier:-1.6,prickliest:-1.4,prickliness:-.6,prickling:-.8,prickly:-.9,pricks:-.9,pricky:-.6,pride:1.4,prison:-2.3,prisoner:-2.5,prisoners:-2.3,privilege:1.5,privileged:1.9,privileges:1.6,privileging:.7,prize:2.3,prized:2.4,prizefight:-.1,prizefighter:1,prizefighters:-.1,prizefighting:.4,prizefights:.3,prizer:1,prizers:.8,prizes:2,prizewinner:2.3,prizewinners:2.4,prizewinning:3,proactive:1.8,problem:-1.7,problematic:-1.9,problematical:-1.8,problematically:-2,problematics:-1.3,problems:-1.7,profit:1.9,profitabilities:1.1,profitability:1.1,profitable:1.9,profitableness:2.4,profitably:1.6,profited:1.3,profiteer:.8,profiteered:-.5,profiteering:-.6,profiteers:.5,profiter:.7,profiterole:.4,profiteroles:.5,profiting:1.6,profitless:-1.5,profits:1.9,profitwise:.9,progress:1.8,prominent:1.3,promiscuities:-.8,promiscuity:-1.8,promiscuous:-.3,promiscuously:-1.5,promiscuousness:-.9,promise:1.3,promised:1.5,promisee:.8,promisees:1.1,promiser:1.3,promisers:1.6,promises:1.6,promising:1.7,promisingly:1.2,promisor:1,promisors:.4,promissory:.9,promote:1.6,promoted:1.8,promotes:1.4,promoting:1.5,propaganda:-1,prosecute:-1.7,prosecuted:-1.6,prosecutes:-1.8,prosecution:-2.2,prospect:1.2,prospects:1.2,prosperous:2.1,protect:1.6,protected:1.9,protects:1.3,protest:-1,protested:-.5,protesters:-.9,protesting:-1.8,protests:-.9,proud:2.1,prouder:2.2,proudest:2.6,proudful:1.9,proudhearted:1.4,proudly:2.6,provoke:-1.7,provoked:-1.1,provokes:-1.3,provoking:-.8,pseudoscience:-1.2,puke:-2.4,puked:-1.8,pukes:-1.9,puking:-1.8,pukka:2.8,punish:-2.4,punishabilities:-1.7,punishability:-1.6,punishable:-1.9,punished:-2,punisher:-1.9,punishers:-2.6,punishes:-2.1,punishing:-2.6,punishment:-2.2,punishments:-1.8,punitive:-2.3,pushy:-1.1,puzzled:-.7,quaking:-1.5,questionable:-1.2,questioned:-.4,questioning:-.4,racism:-3.1,racist:-3,racists:-2.5,radian:.4,radiance:1.4,radiances:1.1,radiancies:.8,radiancy:1.4,radians:.2,radiant:2.1,radiantly:1.3,radiants:1.2,rage:-2.6,raged:-2,ragee:-.4,rageful:-2.8,rages:-2.1,raging:-2.4,rainy:-.3,rancid:-2.5,rancidity:-2.6,rancidly:-2.5,rancidness:-2.6,rancidnesses:-1.6,rant:-1.4,ranter:-1.2,ranters:-1.2,rants:-1.3,rape:-3.7,raped:-3.6,raper:-3.4,rapers:-3.6,rapes:-3.5,rapeseeds:-.5,raping:-3.8,rapist:-3.9,rapists:-3.3,rapture:.6,raptured:.9,raptures:.7,rapturous:1.7,rash:-1.7,ratified:.6,reach:.1,reached:.4,reaches:.2,reaching:.8,readiness:1,ready:1.5,reassurance:1.5,reassurances:1.4,reassure:1.4,reassured:1.7,reassures:1.5,reassuring:1.7,reassuringly:1.8,rebel:-.6,rebeldom:-1.5,rebelled:-1,rebelling:-1.1,rebellion:-.5,rebellions:-1.1,rebellious:-1.2,rebelliously:-1.8,rebelliousness:-1.2,rebels:-.8,recession:-1.8,reckless:-1.7,recommend:1.5,recommended:.8,recommends:.9,redeemed:1.3,reek:-2.4,reeked:-2,reeker:-1.7,reekers:-1.5,reeking:-2,refuse:-1.2,refused:-1.2,refusing:-1.7,regret:-1.8,regretful:-1.9,regretfully:-1.9,regretfulness:-1.6,regrets:-1.5,regrettable:-2.3,regrettably:-2,regretted:-1.6,regretter:-1.6,regretters:-2,regretting:-1.7,reinvigorate:2.3,reinvigorated:1.9,reinvigorates:1.8,reinvigorating:1.7,reinvigoration:2.2,reject:-1.7,rejected:-2.3,rejectee:-2.3,rejectees:-1.8,rejecter:-1.6,rejecters:-1.8,rejecting:-2,rejectingly:-1.7,rejection:-2.5,rejections:-2.1,rejective:-1.8,rejector:-1.8,rejects:-2.2,rejoice:1.9,rejoiced:2,rejoices:2.1,rejoicing:2.8,relax:1.9,relaxant:1,relaxants:.7,relaxation:2.4,relaxations:1,relaxed:2.2,relaxedly:1.5,relaxedness:2,relaxer:1.6,relaxers:1.4,relaxes:1.5,relaxin:1.7,relaxing:2.2,relaxins:1.2,relentless:.2,reliant:.5,relief:2.1,reliefs:1.3,relievable:1.1,relieve:1.5,relieved:1.6,relievedly:1.4,reliever:1.5,relievers:1,relieves:1.5,relieving:1.5,relievo:1.3,relishing:1.6,reluctance:-1.4,reluctancy:-1.6,reluctant:-1,reluctantly:-.4,remarkable:2.6,remorse:-1.1,remorseful:-.9,remorsefully:-.7,remorsefulness:-.7,remorseless:-2.3,remorselessly:-2,remorselessness:-2.8,repetitive:-1,repress:-1.4,repressed:-1.3,represses:-1.3,repressible:-1.5,repressing:-1.8,repression:-1.6,repressions:-1.7,repressive:-1.4,repressively:-1.7,repressiveness:-1,repressor:-1.4,repressors:-2.2,repressurize:-.3,repressurized:.1,repressurizes:.1,repressurizing:-.1,repulse:-2.8,repulsed:-2.2,rescue:2.3,rescued:1.8,rescues:1.3,resent:-.7,resented:-1.6,resentence:-1,resentenced:-.8,resentences:-.6,resentencing:.2,resentful:-2.1,resentfully:-1.4,resentfulness:-2,resenting:-1.2,resentment:-1.9,resentments:-1.9,resents:-1.2,resign:-1.4,resignation:-1.2,resignations:-1.2,resigned:-1,resignedly:-.7,resignedness:-.8,resigner:-1.2,resigners:-1,resigning:-.9,resigns:-1.3,resolute:1.1,resolvable:1,resolve:1.6,resolved:.7,resolvent:.7,resolvents:.4,resolver:.7,resolvers:1.4,resolves:.7,resolving:1.6,respect:2.1,respectabilities:1.8,respectability:2.4,respectable:1.9,respectableness:1.2,respectably:1.7,respected:2.1,respecter:2.1,respecters:1.6,respectful:2,respectfully:1.7,respectfulness:1.9,respectfulnesses:1.3,respecting:2.2,respective:1.8,respectively:1.4,respectiveness:1.1,respects:1.3,responsible:1.3,responsive:1.5,restful:1.5,restless:-1.1,restlessly:-1.4,restlessness:-1.2,restore:1.2,restored:1.4,restores:1.2,restoring:1.2,restrict:-1.6,restricted:-1.6,restricting:-1.6,restriction:-1.1,restricts:-1.3,retained:.1,retard:-2.4,retarded:-2.7,retreat:.8,revenge:-2.4,revenged:-.9,revengeful:-2.4,revengefully:-1.4,revengefulness:-2.2,revenger:-2.1,revengers:-2,revenges:-1.9,revered:2.3,revive:1.4,revives:1.6,reward:2.7,rewardable:2,rewarded:2.2,rewarder:1.6,rewarders:1.9,rewarding:2.4,rewardingly:2.4,rewards:2.1,rich:2.6,richened:1.9,richening:1,richens:.8,richer:2.4,riches:2.4,richest:2.4,richly:1.9,richness:2.2,richnesses:2.1,richweed:.1,richweeds:-.1,ridicule:-2,ridiculed:-1.5,ridiculer:-1.6,ridiculers:-1.6,ridicules:-1.8,ridiculing:-1.8,ridiculous:-1.5,ridiculously:-1.4,ridiculousness:-1.1,ridiculousnesses:-1.6,rig:-.5,rigged:-1.5,rigid:-.5,rigidification:-1.1,rigidifications:-.8,rigidified:-.7,rigidifies:-.6,rigidify:-.3,rigidities:-.7,rigidity:-.7,rigidly:-.7,rigidness:-.3,rigorous:-1.1,rigorously:-.4,riot:-2.6,riots:-2.3,risk:-1.1,risked:-.9,risker:-.8,riskier:-1.4,riskiest:-1.5,riskily:-.7,riskiness:-1.3,riskinesses:-1.6,risking:-1.3,riskless:1.3,risks:-1.1,risky:-.8,rob:-2.6,robber:-2.6,robed:-.7,robing:-1.5,robs:-2,robust:1.4,roflcopter:2.1,romance:2.6,romanced:2.2,romancer:1.3,romancers:1.7,romances:1.3,romancing:2,romantic:1.7,romantically:1.8,romanticise:1.7,romanticised:1.7,romanticises:1.3,romanticising:2.7,romanticism:2.2,romanticisms:2.1,romanticist:1.9,romanticists:1.3,romanticization:1.5,romanticizations:2,romanticize:1.8,romanticized:.9,romanticizes:1.8,romanticizing:1.2,romantics:1.9,rotten:-2.3,rude:-2,rudely:-2.2,rudeness:-1.5,ruder:-2.1,ruderal:-.8,ruderals:-.4,rudesby:-2,rudest:-2.5,ruin:-2.8,ruinable:-1.6,ruinate:-2.8,ruinated:-1.5,ruinates:-1.5,ruinating:-1.5,ruination:-2.7,ruinations:-1.6,ruined:-2.1,ruiner:-2,ruing:-1.6,ruining:-1,ruinous:-2.7,ruinously:-2.6,ruinousness:-1,ruins:-1.9,sabotage:-2.4,sad:-2.1,sadden:-2.6,saddened:-2.4,saddening:-2.2,saddens:-1.9,sadder:-2.4,saddest:-3,sadly:-1.8,sadness:-1.9,safe:1.9,safecracker:-.7,safecrackers:-.9,safecracking:-.9,safecrackings:-.7,safeguard:1.6,safeguarded:1.5,safeguarding:1.1,safeguards:1.4,safekeeping:1.4,safelight:1.1,safelights:.8,safely:2.2,safeness:1.5,safer:1.8,safes:.4,safest:1.7,safeties:1.5,safety:1.8,safetyman:.3,salient:1.1,sappy:-1,sarcasm:-.9,sarcasms:-.9,sarcastic:-1,sarcastically:-1.1,satisfaction:1.9,satisfactions:2.1,satisfactorily:1.6,satisfactoriness:1.5,satisfactory:1.5,satisfiable:1.9,satisfied:1.8,satisfies:1.8,satisfy:2,satisfying:2,satisfyingly:1.9,savage:-2,savaged:-2,savagely:-2.2,savageness:-2.6,savagenesses:-.9,savageries:-1.9,savagery:-2.5,savages:-2.4,save:2.2,saved:1.8,scam:-2.7,scams:-2.8,scandal:-1.9,scandalous:-2.4,scandals:-2.2,scapegoat:-1.7,scapegoats:-1.4,scare:-2.2,scarecrow:-.8,scarecrows:-.7,scared:-1.9,scaremonger:-2.1,scaremongers:-2,scarer:-1.7,scarers:-1.3,scares:-1.4,scarey:-1.7,scaring:-1.9,scary:-2.2,sceptic:-1,sceptical:-1.2,scepticism:-.8,sceptics:-.7,scold:-1.7,scoop:.6,scorn:-1.7,scornful:-1.8,scream:-1.7,screamed:-1.3,screamers:-1.5,screaming:-1.6,screams:-1.2,screw:-.4,screwball:-.2,screwballs:-.3,screwbean:.3,screwdriver:.3,screwdrivers:.1,screwed:-2.2,"screwed up":-1.5,screwer:-1.2,screwers:-.5,screwier:-.6,screwiest:-2,screwiness:-.5,screwing:-.9,screwlike:.1,screws:-1,screwup:-1.7,screwups:-1,screwworm:-.4,screwworms:-.1,screwy:-1.4,scrumptious:2.1,scrumptiously:1.5,scumbag:-3.2,secure:1.4,secured:1.7,securely:1.4,securement:1.1,secureness:1.4,securer:1.5,securers:.6,secures:1.3,securest:2.6,securing:1.3,securities:1.2,securitization:.2,securitizations:.1,securitize:.3,securitized:1.4,securitizes:1.6,securitizing:.7,security:1.4,sedition:-1.8,seditious:-1.7,seduced:-1.5,"self-confident":2.5,selfish:-2.1,selfishly:-1.4,selfishness:-1.7,selfishnesses:-2,sentence:.3,sentenced:-.1,sentences:.2,sentencing:-.6,sentimental:1.3,sentimentalise:1.2,sentimentalised:.8,sentimentalising:.4,sentimentalism:1,sentimentalisms:.4,sentimentalist:.8,sentimentalists:.7,sentimentalities:.9,sentimentality:1.2,sentimentalization:1.2,sentimentalizations:.4,sentimentalize:.8,sentimentalized:1.1,sentimentalizes:1.1,sentimentalizing:.8,sentimentally:1.9,serene:2,serious:-.3,seriously:-.7,seriousness:-.2,severe:-1.6,severed:-1.5,severely:-2,severeness:-1,severer:-1.6,severest:-1.5,sexy:2.4,shake:-.7,shakeable:-.3,shakedown:-1.2,shakedowns:-1.4,shaken:-.3,shakeout:-1.3,shakeouts:-.8,shakers:.3,shakeup:-.6,shakeups:-.5,shakier:-.9,shakiest:-1.2,shakily:-.7,shakiness:-.7,shaking:-.7,shaky:-.9,shame:-2.1,shamed:-2.6,shamefaced:-2.3,shamefacedly:-1.9,shamefacedness:-2,shamefast:-1,shameful:-2.2,shamefully:-1.9,shamefulness:-2.4,shamefulnesses:-2.3,shameless:-1.4,shamelessly:-1.4,shamelessness:-1.4,shamelessnesses:-2,shames:-1.7,share:1.2,shared:1.4,shares:1.2,sharing:1.8,shattered:-2.1,shit:-2.6,shitake:-.3,shitakes:-1.1,shithead:-3.1,shitheads:-2.6,shits:-2.1,shittah:.1,shitted:-1.7,shittier:-2.1,shittiest:-3.4,shittim:-.6,shittimwood:-.3,shitting:-1.8,shitty:-2.6,shock:-1.6,shockable:-1,shocked:-1.3,shocker:-.6,shockers:-1.1,shocking:-1.7,shockingly:-.7,shockproof:1.3,shocks:-1.6,shook:-.4,shoot:-1.4,"short-sighted":-1.2,"short-sightedness":-1.1,shortage:-1,shortages:-.6,shrew:-.9,shy:-1,shyer:-.8,shying:-.9,shylock:-2.1,shylocked:-.7,shylocking:-1.5,shylocks:-1.4,shyly:-.7,shyness:-1.3,shynesses:-1.2,shyster:-1.6,shysters:-.9,sick:-2.3,sicken:-1.9,sickened:-2.5,sickener:-2.2,sickeners:-2.2,sickening:-2.4,sickeningly:-2.1,sickens:-2,sigh:.1,significance:1.1,significant:.8,silencing:-.5,sillibub:-.1,sillier:1,sillies:.8,silliest:.8,sillily:-.1,sillimanite:.1,sillimanites:.2,silliness:-.9,sillinesses:-1.2,silly:.1,sin:-2.6,sincere:1.7,sincerely:2.1,sincereness:1.8,sincerer:2,sincerest:2,sincerities:1.5,sinful:-2.6,singleminded:1.2,sinister:-2.9,sins:-2,skeptic:-.9,skeptical:-1.3,skeptically:-1.2,skepticism:-1,skepticisms:-1.2,skeptics:-.4,slam:-1.6,slash:-1.1,slashed:-.9,slashes:-.8,slashing:-1.1,slavery:-3.8,sleeplessness:-1.6,slicker:.4,slickest:.3,sluggish:-1.7,slut:-2.8,sluts:-2.7,sluttier:-2.7,sluttiest:-3.1,sluttish:-2.2,sluttishly:-2.1,sluttishness:-2.5,sluttishnesses:-2,slutty:-2.3,smart:1.7,smartass:-2.1,smartasses:-1.7,smarted:.7,smarten:1.9,smartened:1.5,smartening:1.7,smartens:1.5,smarter:2,smartest:3,smartie:1.3,smarties:1.7,smarting:-.7,smartly:1.5,smartness:2,smartnesses:1.5,smarts:1.6,smartweed:.2,smartweeds:.1,smarty:1.1,smear:-1.5,smilax:.6,smilaxes:.3,smile:1.5,smiled:2.5,smileless:-1.4,smiler:1.7,smiles:2.1,smiley:1.7,smileys:1.5,smiling:2,smilingly:2.3,smog:-1.2,smother:-1.8,smothered:-.9,smothering:-1.4,smothers:-1.9,smothery:-1.1,smug:.8,smugger:-1,smuggest:-1.5,smuggle:-1.6,smuggled:-1.5,smuggler:-2.1,smugglers:-1.4,smuggles:-1.7,smuggling:-2.1,smugly:.2,smugness:-1.4,smugnesses:-1.7,sneaky:-.9,snob:-2,snobbery:-2,snobbier:-.7,snobbiest:-.5,snobbily:-1.6,snobbish:-.9,snobbishly:-1.2,snobbishness:-1.1,snobbishnesses:-1.7,snobbism:-1,snobbisms:-.3,snobby:-1.7,snobs:-1.4,snub:-1.8,snubbed:-2,snubbing:-.9,snubs:-2.1,sob:-1,sobbed:-1.9,sobbing:-1.6,sobering:-.8,sobs:-2.5,sociabilities:1.2,sociability:1.1,sociable:1.9,sociableness:1.5,sociably:1.6,sok:1.3,solemn:-.3,solemnified:-.5,solemnifies:-.5,solemnify:.3,solemnifying:.1,solemnities:.3,solemnity:-1.1,solemnization:.7,solemnize:.3,solemnized:-.7,solemnizes:.6,solemnizing:-.6,solemnly:.8,solid:.6,solidarity:1.2,solution:1.3,solutions:.7,solve:.8,solved:1.1,solves:1.1,solving:1.4,somber:-1.8,"son-of-a-bitch":-2.7,soothe:1.5,soothed:.5,soothing:1.3,sophisticated:2.6,sore:-1.5,sorrow:-2.4,sorrowed:-2.4,sorrower:-2.3,sorrowful:-2.2,sorrowfully:-2.3,sorrowfulness:-2.5,sorrowing:-1.7,sorrows:-1.6,sorry:-.3,soulmate:2.9,spam:-1.5,spammer:-2.2,spammers:-1.6,spamming:-2.1,spark:.9,sparkle:1.8,sparkles:1.3,sparkling:1.2,special:1.7,speculative:.4,spirit:.7,spirited:1.3,spiritless:-1.3,spite:-2.4,spited:-2.4,spiteful:-1.9,spitefully:-2.3,spitefulness:-1.5,spitefulnesses:-2.3,spites:-1.4,splendent:2.7,splendid:2.8,splendidly:2.1,splendidness:2.3,splendiferous:2.6,splendiferously:1.9,splendiferousness:1.7,splendor:3,splendorous:2.2,splendors:2,splendour:2.2,splendours:2.2,splendrous:2.2,sprightly:2,squelched:-1,stab:-2.8,stabbed:-1.9,stable:1.2,stabs:-1.9,stall:-.8,stalled:-.8,stalling:-.8,stamina:1.2,stammer:-.9,stammered:-.9,stammerer:-1.1,stammerers:-.8,stammering:-1,stammers:-.8,stampede:-1.8,stank:-1.9,startle:-1.3,startled:-.7,startlement:-.5,startlements:.2,startler:-.8,startlers:-.5,startles:-.5,startling:.3,startlingly:-.3,starve:-1.9,starved:-2.6,starves:-2.3,starving:-1.8,steadfast:1,steal:-2.2,stealable:-1.7,stealer:-1.7,stealers:-2.2,stealing:-2.7,stealings:-1.9,steals:-2.3,stealth:-.3,stealthier:-.3,stealthiest:.4,stealthily:.1,stealthiness:.2,stealths:-.3,stealthy:-.1,stench:-2.3,stenches:-1.5,stenchful:-2.4,stenchy:-2.3,stereotype:-1.3,stereotyped:-1.2,stifled:-1.4,stimulate:.9,stimulated:.9,stimulates:1,stimulating:1.9,stingy:-1.6,stink:-1.7,stinkard:-2.3,stinkards:-1,stinkbug:-.2,stinkbugs:-1,stinker:-1.5,stinkers:-1.2,stinkhorn:-.2,stinkhorns:-.8,stinkier:-1.5,stinkiest:-2.1,stinking:-2.4,stinkingly:-1.3,stinko:-1.5,stinkpot:-2.5,stinkpots:-.7,stinks:-1,stinkweed:-.4,stinkwood:-.1,stinky:-1.5,stolen:-2.2,stop:-1.2,stopped:-.9,stopping:-.6,stops:-.6,stout:.7,straight:.9,strain:-.2,strained:-1.7,strainer:-.8,strainers:-.3,straining:-1.3,strains:-1.2,strange:-.8,strangely:-1.2,strangled:-2.5,strength:2.2,strengthen:1.3,strengthened:1.8,strengthener:1.8,strengtheners:1.4,strengthening:2.2,strengthens:2,strengths:1.7,stress:-1.8,stressed:-1.4,stresses:-2,stressful:-2.3,stressfully:-2.6,stressing:-1.5,stressless:1.6,stresslessness:1.6,stressor:-1.8,stressors:-2.1,stricken:-2.3,strike:-.5,strikers:-.6,strikes:-1.5,strong:2.3,strongbox:.7,strongboxes:.3,stronger:1.6,strongest:1.9,stronghold:.5,strongholds:1,strongish:1.7,strongly:1.1,strongman:.7,strongmen:.5,strongyl:.6,strongyles:.2,strongyloidosis:-.8,strongyls:.1,struck:-1,struggle:-1.3,struggled:-1.4,struggler:-1.1,strugglers:-1.4,struggles:-1.5,struggling:-1.8,stubborn:-1.7,stubborner:-1.5,stubbornest:-.6,stubbornly:-1.4,stubbornness:-1.1,stubbornnesses:-1.5,stuck:-1,stunk:-1.6,stunned:-.4,stunning:1.6,stuns:.1,stupid:-2.4,stupider:-2.5,stupidest:-2.4,stupidities:-2,stupidity:-1.9,stupidly:-2,stupidness:-1.7,stupidnesses:-2.6,stupids:-2.3,stutter:-1,stuttered:-.9,stutterer:-1,stutterers:-1.1,stuttering:-1.3,stutters:-1,suave:2,submissive:-1.3,submissively:-1,submissiveness:-.7,substantial:.8,subversive:-.9,succeed:2.2,succeeded:1.8,succeeder:1.2,succeeders:1.3,succeeding:2.2,succeeds:2.2,success:2.7,successes:2.6,successful:2.8,successfully:2.2,successfulness:2.7,succession:.8,successional:.9,successionally:1.1,successions:.1,successive:1.1,successively:.9,successiveness:1,successor:.9,successors:1.1,suck:-1.9,sucked:-2,sucker:-2.4,suckered:-2,suckering:-2.1,suckers:-2.3,sucks:-1.5,sucky:-1.9,suffer:-2.5,suffered:-2.2,sufferer:-2,sufferers:-2.4,suffering:-2.1,suffers:-2.1,suicidal:-3.5,suicide:-3.5,suing:-1.1,sulking:-1.5,sulky:-.8,sullen:-1.7,sunnier:2.3,sunniest:2.4,sunny:1.8,sunshine:2.2,sunshiny:1.9,super:2.9,superb:3.1,superior:2.5,superiorities:.8,superiority:1.4,superiorly:2.2,superiors:1,support:1.7,supported:1.3,supporter:1.1,supporters:1.9,supporting:1.9,supportive:1.2,supportiveness:1.5,supports:1.5,supremacies:.8,supremacist:.5,supremacists:-1,supremacy:.2,suprematists:.4,supreme:2.6,supremely:2.7,supremeness:2.3,supremer:2.3,supremest:2.2,supremo:1.9,supremos:1.3,sure:1.3,surefire:1,surefooted:1.9,surefootedly:1.6,surefootedness:1.5,surely:1.9,sureness:2,surer:1.2,surest:1.3,sureties:1.3,surety:1,suretyship:-.1,suretyships:.4,surprisal:1.5,surprisals:.7,surprise:1.1,surprised:.9,surpriser:.6,surprisers:.3,surprises:.9,surprising:1.1,surprisingly:1.2,survived:2.3,surviving:1.2,survivor:1.5,suspect:-1.2,suspected:-.9,suspecting:-.7,suspects:-1.4,suspend:-1.3,suspended:-2.1,suspicion:-1.6,suspicions:-1.5,suspicious:-1.5,suspiciously:-1.7,suspiciousness:-1.2,sux:-1.5,swear:-.2,swearing:-1,swears:.2,sweet:2,"sweet<3":3,sweetheart:3.3,sweethearts:2.8,sweetie:2.2,sweeties:2.1,sweetly:2.1,sweetness:2.2,sweets:2.2,swift:.8,swiftly:1.2,swindle:-2.4,swindles:-1.5,swindling:-2,sympathetic:2.3,sympathy:1.5,talent:1.8,talented:2.3,talentless:-1.6,talents:2,tantrum:-1.8,tantrums:-1.5,tard:-2.5,tears:-.9,teas:.3,tease:-1.3,teased:-1.2,teasel:-.1,teaseled:-.8,teaseler:-.8,teaselers:-1.2,teaseling:-.4,teaselled:-.4,teaselling:-.2,teasels:-.1,teaser:-1,teasers:-.7,teases:-1.2,teashops:.2,teasing:-.3,teasingly:-.4,teaspoon:.2,teaspoonful:.2,teaspoonfuls:.4,teaspoons:.5,teaspoonsful:.3,temper:-1.8,tempers:-1.3,tendered:.5,tenderer:.6,tenderers:1.2,tenderest:1.4,tenderfeet:-.4,tenderfoot:-.1,tenderfoots:-.5,tenderhearted:1.5,tenderheartedly:2.7,tenderheartedness:.7,tenderheartednesses:2.8,tendering:.6,tenderization:.2,tenderize:.1,tenderized:.1,tenderizer:.4,tenderizes:.3,tenderizing:.3,tenderloin:-.2,tenderloins:.4,tenderly:1.8,tenderness:1.8,tendernesses:.9,tenderometer:.2,tenderometers:.2,tenders:.6,tense:-1.4,tensed:-1,tensely:-1.2,tenseness:-1.5,tenser:-1.5,tenses:-.9,tensest:-1.2,tensing:-1,tension:-1.3,tensional:-.8,tensioned:-.4,tensioner:-1.6,tensioners:-.9,tensioning:-1.4,tensionless:.6,tensions:-1.7,terrible:-2.1,terribleness:-1.9,terriblenesses:-2.6,terribly:-2.6,terrific:2.1,terrifically:1.7,terrified:-3,terrifies:-2.6,terrify:-2.3,terrifying:-2.7,terror:-2.4,terrorise:-3.1,terrorised:-3.3,terrorises:-3.3,terrorising:-3,terrorism:-3.6,terrorisms:-3.2,terrorist:-3.7,terroristic:-3.3,terrorists:-3.1,terrorization:-2.7,terrorize:-3.3,terrorized:-3.1,terrorizes:-3.1,terrorizing:-3,terrorless:.9,terrors:-2.6,thank:1.5,thanked:1.9,thankful:2.7,thankfuller:1.9,thankfullest:2,thankfully:1.8,thankfulness:2.1,thanks:1.9,thief:-2.4,thieve:-2.2,thieved:-1.4,thieveries:-2.1,thievery:-2,thieves:-2.3,thorny:-1.1,thoughtful:1.6,thoughtfully:1.7,thoughtfulness:1.9,thoughtless:-2,threat:-2.4,threaten:-1.6,threatened:-2,threatener:-1.4,threateners:-1.8,threatening:-2.4,threateningly:-2.2,threatens:-1.6,threating:-2,threats:-1.8,thrill:1.5,thrilled:1.9,thriller:.4,thrillers:.1,thrilling:2.1,thrillingly:2,thrills:1.5,thwarted:-.1,thwarting:-.7,thwarts:-.4,ticked:-1.8,timid:-1,timider:-1,timidest:-.9,timidities:-.7,timidity:-1.3,timidly:-.7,timidness:-1,timorous:-.8,tired:-1.9,tits:-.9,tolerance:1.2,tolerances:.3,tolerant:1.1,tolerantly:.4,toothless:-1.4,top:.8,tops:2.3,torn:-1,torture:-2.9,tortured:-2.6,torturer:-2.3,torturers:-3.5,tortures:-2.5,torturing:-3,torturous:-2.7,torturously:-2.2,totalitarian:-2.1,totalitarianism:-2.7,tough:-.5,toughed:.7,toughen:.1,toughened:.1,toughening:.9,toughens:-.2,tougher:.7,toughest:-.3,toughie:-.7,toughies:-.6,toughing:-.5,toughish:-1,toughly:-1.1,toughness:-.2,toughnesses:.3,toughs:-.8,toughy:-.5,tout:-.5,touted:-.2,touting:-.7,touts:-.1,tragedian:-.5,tragedians:-1,tragedienne:-.4,tragediennes:-1.4,tragedies:-1.9,tragedy:-3.4,tragic:-2,tragical:-2.4,tragically:-2.7,tragicomedy:.2,tragicomic:-.2,tragics:-2.2,tranquil:.2,tranquiler:1.9,tranquilest:1.6,tranquilities:1.5,tranquility:1.8,tranquilize:.3,tranquilized:-.2,tranquilizer:-.1,tranquilizers:-.4,tranquilizes:-.1,tranquilizing:-.5,tranquillest:.8,tranquillities:.5,tranquillity:1.8,tranquillized:-.2,tranquillizer:-.1,tranquillizers:-.2,tranquillizes:.1,tranquillizing:.8,tranquilly:1.2,tranquilness:1.5,trap:-1.3,trapped:-2.4,trauma:-1.8,traumas:-2.2,traumata:-1.7,traumatic:-2.7,traumatically:-2.8,traumatise:-2.8,traumatised:-2.4,traumatises:-2.2,traumatising:-1.9,traumatism:-2.4,traumatization:-3,traumatizations:-2.2,traumatize:-2.4,traumatized:-1.7,traumatizes:-1.4,traumatizing:-2.3,travesty:-2.7,treason:-1.9,treasonous:-2.7,treasurable:2.5,treasure:1.2,treasured:2.6,treasurer:.5,treasurers:.4,treasurership:.4,treasurerships:1.2,treasures:1.8,treasuries:.9,treasuring:2.1,treasury:.8,treat:1.7,tremble:-1.1,trembled:-1.1,trembler:-.6,tremblers:-1,trembles:-.1,trembling:-1.5,trembly:-1.2,tremulous:-1,trick:-.2,tricked:-.6,tricker:-.9,trickeries:-1.2,trickers:-1.4,trickery:-1.1,trickie:-.4,trickier:-.7,trickiest:-1.2,trickily:-.8,trickiness:-1.2,trickinesses:-.4,tricking:.1,trickish:-1,trickishly:-.7,trickishness:-.4,trickled:.1,trickledown:-.7,trickles:.2,trickling:-.2,trickly:-.3,tricks:-.5,tricksier:-.5,tricksiness:-1,trickster:-.9,tricksters:-1.3,tricksy:-.8,tricky:-.6,trite:-.8,triumph:2.1,triumphal:2,triumphalisms:1.9,triumphalist:.5,triumphalists:.9,triumphant:2.4,triumphantly:2.3,triumphed:2.2,triumphing:2.3,triumphs:2,trivial:-.1,trivialise:-.8,trivialised:-.8,trivialises:-1.1,trivialising:-1.4,trivialities:-1,triviality:-.5,trivialization:-.9,trivializations:-.7,trivialize:-1.1,trivialized:-.6,trivializes:-1,trivializing:-.6,trivially:.4,trivium:-.3,trouble:-1.7,troubled:-2,troublemaker:-2,troublemakers:-2.2,troublemaking:-1.8,troubler:-1.4,troublers:-1.9,troubles:-2,troubleshoot:.8,troubleshooter:1,troubleshooters:.8,troubleshooting:.7,troubleshoots:.5,troublesome:-2.3,troublesomely:-1.8,troublesomeness:-1.9,troubling:-2.5,troublous:-2.1,troublously:-2.1,trueness:2.1,truer:1.5,truest:1.9,truly:1.9,trust:2.3,trustability:2.1,trustable:2.3,trustbuster:-.5,trusted:2.1,trustee:1,trustees:.3,trusteeship:.5,trusteeships:.6,truster:1.9,trustful:2.1,trustfully:1.5,trustfulness:2.1,trustier:1.3,trusties:1,trustiest:2.2,trustily:1.6,trustiness:1.6,trusting:1.7,trustingly:1.6,trustingness:1.6,trustless:-2.3,trustor:.4,trustors:1.2,trusts:2.1,trustworthily:2.3,trustworthiness:1.8,trustworthy:2.6,trusty:2.2,truth:1.3,truthful:2,truthfully:1.9,truthfulness:1.7,truths:1.8,tumor:-1.6,turmoil:-1.5,twat:-3.4,ugh:-1.8,uglier:-2.2,uglies:-2,ugliest:-2.8,uglification:-2.2,uglified:-1.5,uglifies:-1.8,uglify:-2.1,uglifying:-2.2,uglily:-2.1,ugliness:-2.7,uglinesses:-2.5,ugly:-2.3,unacceptable:-2,unappreciated:-1.7,unapproved:-1.4,unattractive:-1.9,unaware:-.8,unbelievable:.8,unbelieving:-.8,unbiased:-.1,uncertain:-1.2,uncertainly:-1.4,uncertainness:-1.3,uncertainties:-1.4,uncertainty:-1.4,unclear:-1,uncomfortable:-1.6,uncomfortably:-1.7,uncompelling:-.9,unconcerned:-.9,unconfirmed:-.5,uncontrollability:-1.7,uncontrollable:-1.5,uncontrollably:-1.5,uncontrolled:-1,unconvinced:-1.6,uncredited:-1,undecided:-.9,underestimate:-1.2,underestimated:-1.1,underestimates:-1.1,undermine:-1.2,undermined:-1.5,undermines:-1.4,undermining:-1.5,undeserving:-1.9,undesirable:-1.9,unease:-1.7,uneasier:-1.4,uneasiest:-2.1,uneasily:-1.4,uneasiness:-1.6,uneasinesses:-1.8,uneasy:-1.6,unemployment:-1.9,unequal:-1.4,unequaled:.5,unethical:-2.3,unfair:-2.1,unfocused:-1.7,unfortunate:-2,unfortunately:-1.4,unfortunates:-1.9,unfriendly:-1.5,unfulfilled:-1.8,ungrateful:-2,ungratefully:-1.8,ungratefulness:-1.6,unhappier:-2.4,unhappiest:-2.5,unhappily:-1.9,unhappiness:-2.4,unhappinesses:-2.2,unhappy:-1.8,unhealthy:-2.4,unified:1.6,unimportant:-1.3,unimpressed:-1.4,unimpressive:-1.4,unintelligent:-2,uninvolved:-2.2,uninvolving:-2,united:1.8,unjust:-2.3,unkind:-1.6,unlovable:-2.7,unloved:-1.9,unlovelier:-1.9,unloveliest:-1.9,unloveliness:-2,unlovely:-2.1,unloving:-2.3,unmatched:-.3,unmotivated:-1.4,unpleasant:-2.1,unprofessional:-2.3,unprotected:-1.5,unresearched:-1.1,unsatisfied:-1.7,unsavory:-1.9,unsecured:-1.6,unsettled:-1.3,unsophisticated:-1.2,unstable:-1.5,unstoppable:-.8,unsuccessful:-1.5,unsuccessfully:-1.7,unsupported:-1.7,unsure:-1,unsurely:-1.3,untarnished:1.6,unwanted:-.9,unwelcome:-1.7,unworthy:-2,upset:-1.6,upsets:-1.5,upsetter:-1.9,upsetters:-2,upsetting:-2.1,uptight:-1.6,uptightness:-1.2,urgent:.8,useful:1.9,usefully:1.8,usefulness:1.2,useless:-1.8,uselessly:-1.5,uselessness:-1.6,"v.v":-2.9,vague:-.4,vain:-1.8,validate:1.5,validated:.9,validates:1.4,validating:1.4,valuable:2.1,valuableness:1.7,valuables:2.1,valuably:2.3,value:1.4,valued:1.9,values:1.7,valuing:1.4,vanity:-.9,verdict:.6,verdicts:.3,vested:.6,vexation:-1.9,vexing:-2,vibrant:2.4,vicious:-1.5,viciously:-1.3,viciousness:-2.4,viciousnesses:-.6,victim:-1.1,victimhood:-2,victimhoods:-.9,victimise:-1.1,victimised:-1.5,victimises:-1.2,victimising:-2.5,victimization:-2.3,victimizations:-1.5,victimize:-2.5,victimized:-1.8,victimizer:-1.8,victimizers:-1.6,victimizes:-1.5,victimizing:-2.6,victimless:.6,victimologies:-.6,victimologist:-.5,victimologists:-.4,victimology:.3,victims:-1.3,vigilant:.7,vigor:1.1,vigorish:-.4,vigorishes:.4,vigoroso:1.5,vigorously:.5,vigorousness:.4,vigors:1,vigour:.9,vigours:.4,vile:-3.1,villain:-2.6,villainess:-2.9,villainesses:-2,villainies:-2.3,villainous:-2,villainously:-2.9,villainousness:-2.7,villains:-3.4,villainy:-2.6,vindicate:.3,vindicated:1.8,vindicates:1.6,vindicating:-1.1,violate:-2.2,violated:-2.4,violater:-2.6,violaters:-2.4,violates:-2.3,violating:-2.5,violation:-2.2,violations:-2.4,violative:-2.4,violator:-2.4,violators:-1.9,violence:-3.1,violent:-2.9,violently:-2.8,virtue:1.8,virtueless:-1.4,virtues:1.5,virtuosa:1.7,virtuosas:1.8,virtuose:1,virtuosi:.9,virtuosic:2.2,virtuosity:2.1,virtuoso:2,virtuosos:1.8,virtuous:2.4,virtuously:1.8,virtuousness:2,virulent:-2.7,vision:1,visionary:2.4,visioning:1.1,visions:.9,vital:1.2,vitalise:1.1,vitalised:.6,vitalises:1.1,vitalising:2.1,vitalism:.2,vitalist:.3,vitalists:.3,vitalities:1.2,vitality:1.3,vitalization:1.6,vitalizations:.8,vitalize:1.6,vitalized:1.5,vitalizes:1.4,vitalizing:1.3,vitally:1.1,vitals:1.1,vitamin:1.2,vitriolic:-2.1,vivacious:1.8,vociferous:-.8,vulnerabilities:-.6,vulnerability:-.9,vulnerable:-.9,vulnerableness:-1.1,vulnerably:-1.2,vulture:-2,vultures:-1.3,w00t:2.2,walkout:-1.3,walkouts:-.7,wanker:-2.5,want:.3,war:-2.9,warfare:-1.2,warfares:-1.8,warm:.9,warmblooded:.2,warmed:1.1,warmer:1.2,warmers:1,warmest:1.7,warmhearted:1.8,warmheartedness:2.7,warming:.6,warmish:1.4,warmly:1.7,warmness:1.5,warmonger:-2.9,warmongering:-2.5,warmongers:-2.8,warmouth:.4,warmouths:-.8,warms:1.1,warmth:2,warmup:.4,warmups:.8,warn:-.4,warned:-1.1,warning:-1.4,warnings:-1.2,warns:-.4,warred:-2.4,warring:-1.9,wars:-2.6,warsaw:-.1,warsaws:-.2,warship:-.7,warships:-.5,warstle:.1,waste:-1.8,wasted:-2.2,wasting:-1.7,wavering:-.6,weak:-1.9,weaken:-1.8,weakened:-1.3,weakener:-1.6,weakeners:-1.3,weakening:-1.3,weakens:-1.3,weaker:-1.9,weakest:-2.3,weakfish:-.2,weakfishes:-.6,weakhearted:-1.6,weakish:-1.2,weaklier:-1.5,weakliest:-2.1,weakling:-1.3,weaklings:-1.4,weakly:-1.8,weakness:-1.8,weaknesses:-1.5,weakside:-1.1,wealth:2.2,wealthier:2.2,wealthiest:2.2,wealthily:2,wealthiness:2.4,wealthy:1.5,weapon:-1.2,weaponed:-1.4,weaponless:.1,weaponry:-.9,weapons:-1.9,weary:-1.1,weep:-2.7,weeper:-1.9,weepers:-1.1,weepie:-.4,weepier:-1.8,weepies:-1.6,weepiest:-2.4,weeping:-1.9,weepings:-1.9,weeps:-1.4,weepy:-1.3,weird:-.7,weirder:-.5,weirdest:-.9,weirdie:-1.3,weirdies:-1,weirdly:-1.2,weirdness:-.9,weirdnesses:-.7,weirdo:-1.8,weirdoes:-1.3,weirdos:-1.1,weirds:-.6,weirdy:-.9,welcome:2,welcomed:1.4,welcomely:1.9,welcomeness:2,welcomer:1.4,welcomers:1.9,welcomes:1.7,welcoming:1.9,well:1.1,welladay:.3,wellaway:-.8,wellborn:1.8,welldoer:2.5,welldoers:1.6,welled:.4,wellhead:.1,wellheads:.5,wellhole:-.1,wellies:.4,welling:1.6,wellness:1.9,wells:1,wellsite:.5,wellspring:1.5,wellsprings:1.4,welly:.2,wept:-2,whimsical:.3,whine:-1.5,whined:-.9,whiner:-1.2,whiners:-.6,whines:-1.8,whiney:-1.3,whining:-.9,whitewash:.1,whore:-3.3,whored:-2.8,whoredom:-2.1,whoredoms:-2.4,whorehouse:-1.1,whorehouses:-1.9,whoremaster:-1.9,whoremasters:-1.5,whoremonger:-2.6,whoremongers:-2,whores:-3,whoreson:-2.2,whoresons:-2.5,wicked:-2.4,wickeder:-2.2,wickedest:-2.9,wickedly:-2.1,wickedness:-2.1,wickednesses:-2.2,widowed:-2.1,willingness:1.1,wimp:-1.4,wimpier:-1,wimpiest:-.9,wimpiness:-1.2,wimpish:-1.6,wimpishness:-.2,wimple:-.2,wimples:-.3,wimps:-1,wimpy:-.9,win:2.8,winnable:1.8,winned:1.8,winner:2.8,winners:2.1,winning:2.4,winningly:2.3,winnings:2.5,winnow:-.3,winnower:-.1,winnowers:-.2,winnowing:-.1,winnows:-.2,wins:2.7,wisdom:2.4,wise:2.1,wiseacre:-1.2,wiseacres:-.1,wiseass:-1.8,wiseasses:-1.5,wisecrack:-.1,wisecracked:-.5,wisecracker:-.1,wisecrackers:.1,wisecracking:-.6,wisecracks:-.3,wised:1.5,wiseguys:.3,wiselier:.9,wiseliest:1.6,wisely:1.8,wiseness:1.9,wisenheimer:-1,wisenheimers:-1.4,wisents:.4,wiser:1.2,wises:1.3,wisest:2.1,wisewomen:1.3,wish:1.7,wishes:.6,wishing:.9,witch:-1.5,withdrawal:.1,woe:-1.8,woebegone:-2.6,woebegoneness:-1.1,woeful:-1.9,woefully:-1.7,woefulness:-2.1,woes:-1.9,woesome:-1.2,won:2.7,wonderful:2.7,wonderfully:2.9,wonderfulness:2.9,woo:2.1,woohoo:2.3,woot:1.8,worn:-1.2,worried:-1.2,worriedly:-2,worrier:-1.8,worriers:-1.7,worries:-1.8,worriment:-1.5,worriments:-1.9,worrisome:-1.7,worrisomely:-2,worrisomeness:-1.9,worrit:-2.1,worrits:-1.2,worry:-1.9,worrying:-1.4,worrywart:-1.8,worrywarts:-1.5,worse:-2.1,worsen:-2.3,worsened:-1.9,worsening:-2,worsens:-2.1,worser:-2,worship:1.2,worshiped:2.4,worshiper:1,worshipers:.9,worshipful:.7,worshipfully:1.1,worshipfulness:1.6,worshiping:1,worshipless:-.6,worshipped:2.7,worshipper:.6,worshippers:.8,worshipping:1.6,worships:1.4,worst:-3.1,worth:.9,worthless:-1.9,worthwhile:1.4,worthy:1.9,wow:2.8,wowed:2.6,wowing:2.5,wows:2,wowser:-1.1,wowsers:1,wrathful:-2.7,wreck:-1.9,wrong:-2.1,wronged:-1.9,"x-d":2.6,"x-p":1.7,xd:2.8,xp:1.6,yay:2.4,yeah:1.2,yearning:.5,yeees:1.7,yep:1.2,yes:1.7,youthful:1.3,yucky:-1.8,yummy:2.4,zealot:-1.9,zealots:-.8,zealous:.5,"{:":1.8,"|-0":-1.2,"|-:":-.8,"|-:>":-1.6,"|-o":-1.2,"|:":-.5,"|;-)":2.2,"|=":-.4,"|^:":-1.1,"|o:":-.9,"||-:":-2.3,"}:":-2.1,"}:(":-2,"}:)":.4,"}:-(":-2.1,"}:-)":.3}},function(e,s,i){"use strict";Object.defineProperty(s,"__esModule",{value:!0});var r=function(){function e(e,s){for(var i=0;i<s.length;i++){var r=s[i];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r)}}return function(s,i,r){return i&&e(s.prototype,i),r&&e(s,r),s}}();function t(e,s){if(!(e instanceof s))throw new TypeError("Cannot call a class as a function")}var n=i(0).lexicon,a=s.B_INCR=.293,l=s.B_DECR=-.293,o=s.C_INCR=.733,d=s.N_SCALAR=-.74,u=s.REGEX_REMOVE_PUNCTUATION=new RegExp(/[!"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~]/g),c=s.PUNC_LIST=[".","!","?",",",";",":","-","'",'"',"!!","!!!","??","???","?!?","!?!","?!?!","!?!?"],g=s.NEGATE=["aint","arent","cannot","cant","couldnt","darent","didnt","doesnt","ain't","aren't","can't","couldn't","daren't","didn't","doesn't","dont","hadnt","hasnt","havent","isnt","mightnt","mustnt","neither","don't","hadn't","hasn't","haven't","isn't","mightn't","mustn't","neednt","needn't","never","none","nope","nor","not","nothing","nowhere","oughtnt","shant","shouldnt","uhuh","wasnt","werent","oughtn't","shan't","shouldn't","uh-uh","wasn't","weren't","without","wont","wouldnt","won't","wouldn't","rarely","seldom","despite"],m=s.BOOSTER_DICT={absolutely:a,amazingly:a,awfully:a,completely:a,considerably:a,decidedly:a,deeply:a,effing:a,enormously:a,entirely:a,especially:a,exceptionally:a,extremely:a,fabulously:a,flipping:a,flippin:a,fricking:a,frickin:a,frigging:a,friggin:a,fully:a,fucking:a,greatly:a,hella:a,highly:a,hugely:a,incredibly:a,intensely:a,majorly:a,more:a,most:a,particularly:a,purely:a,quite:a,really:a,remarkably:a,so:a,substantially:a,thoroughly:a,totally:a,tremendously:a,uber:a,unbelievably:a,unusually:a,utterly:a,very:a,almost:l,barely:l,hardly:l,"just enough":l,"kind of":l,kinda:l,kindof:l,"kind-of":l,less:l,little:l,marginally:l,occasionally:l,partly:l,scarcely:l,slightly:l,somewhat:l,"sort of":l,sorta:l,sortof:l,"sort-of":l},p=s.SPECIAL_CASE_IDIOMS={"the shit":3,"the bomb":3,"bad ass":1.5,"yeah right":-2,"cut the mustard":2,"kiss of death":-1.5,"hand to mouth":-2},h=s.negated=function(e){var s=!(arguments.length>1&&void 0!==arguments[1])||arguments[1],i=[];i.push.apply(i,g);for(var r=0;r<i.length;r++)if(e.indexOf(i[r])>=0)return!0;if(!0===s)for(var t=0;t<e.length;t++)if(e[t].indexOf("n't")>=0)return!0;var n=e.findIndex(function(e){return"least"===e});return-1!==n&&n>0&&"at"!==e[n-1]},f=s.normalize=function(e){var s=arguments.length>1&&void 0!==arguments[1]?arguments[1]:15,i=e/Math.sqrt(e*e+s);return i<-1?-1:i>1?1:i},y=s.allcap_differential=function(e){for(var s=0,i=0;i<e.length;i++)v(e[i])&&(s+=1);var r=e.length-s;return r>0&&r<e.length},b=s.scalar_inc_dec=function(e,s,i){var r=0,t=e.toLowerCase();return m.hasOwnProperty(t)&&(r=m[t],s<0&&(r*=-1),i&&v(e)&&(s>0?r+=o:r-=o)),r},v=s.is_upper_python=function(e){return("string"==typeof e||e instanceof String)&&e.length>0&&/^[^a-z]*[A-Z]+[^a-z]*$/g.test(e)},w=s.SentiText=function(){function e(s){t(this,e),this.text=s,this.words_and_emoticons=this.get_words_and_emoticons(),this.is_cap_diff=y(this.words_and_emoticons)}return r(e,[{key:"get_words_plus_punc",value:function(){for(var e=this.text.slice(0).replace(u,"").split(/\s/).filter(function(e){return e.length>1}),s={},i=0;i<c.length;i++)for(var r=0;r<e.length;r++){var t=""+c[i]+e[r],n=""+e[r]+c[i];s[t]=e[r],s[n]=e[r]}return s}},{key:"get_words_and_emoticons",value:function(){for(var e=this.text.split(/\s/),s=this.get_words_plus_punc(),i=e.filter(function(e){return e.length>1}),r=0;r<i.length;r++)s.hasOwnProperty(i[r])&&(i[r]=s[i[r]]);return i}}]),e}();s.SentimentIntensityAnalyzer=function(){function e(){t(this,e)}return r(e,null,[{key:"polarity_scores",value:function(s){for(var i=new w(s),r=[],t=i.words_and_emoticons,n=0;n<t.length;n++){var a=t[n];n<t.length-1&&"kind"===a.toLowerCase()&&"of"===t[n+1].toLowerCase()||m.hasOwnProperty(a.toLowerCase())?r.push(0):r=e.sentiment_valence(0,i,a,n,r)}return r=e.but_check(t,r),e.score_valence(r,s)}},{key:"sentiment_valence",value:function(e,s,i,r,t){var a=s.is_cap_diff,l=s.words_and_emoticons,d=i.toLowerCase();if(n.hasOwnProperty(d)){e=n[d],v(i)&&a&&(e>0?e+=o:e-=o);for(var u=0;u<3;u++)if(r>u&&!1===n.hasOwnProperty(l[r-(u+1)].toLowerCase())){var c=b(l[r-(u+1)],e,a);1===u&&0!==c?c*=.95:2===u&&0!==c&&(c*=.9),e+=c,e=this.never_check(e,l,u,r),2===u&&(e=this.idioms_check(e,l,r))}e=this.least_check(e,l,r)}return t.push(e),t}},{key:"least_check",value:function(e,s,i){return i>1&&"least"===s[i-1].toLowerCase()&&!1===n.hasOwnProperty(s[i-1].toLowerCase())?"at"!==s[i-2].toLowerCase()&&"very"!==s[i-2].toLowerCase()&&(e*=d):i>0&&"least"===s[i-1].toLowerCase()&&!1===n.hasOwnProperty(s[i-1].toLowerCase())&&(e*=d),e}},{key:"but_check",value:function(e,s){var i=e.indexOf("but");if(-1===i&&(i=e.indexOf("BUT")),-1!==i)for(var r=0;r<s.length;r++){var t=r,n=s[t];t<i?(s.splice(t,1),s.splice(t,0,.5*n)):t>i&&(s.splice(t,1),s.splice(t,0,1.5*n))}return s}},{key:"idioms_check",value:function(e,s,i){for(var r=s[i-1]+" "+s[i],t=s[i-2]+" "+s[i-1]+" "+s[i],n=s[i-2]+" "+s[i-1],a=s[i-3]+" "+s[i-2]+" "+s[i-1],o=s[i-3]+" "+s[i-2],d=[r,t,n,a,o],u=0;u<d.length;u++)if(p.hasOwnProperty(d[u])){e=p[d[u]];break}if(s.length-1>i){var c=s[i]+" "+s[i+1];p.hasOwnProperty(c)&&(e=p[c])}if(s.length-1>i+1){var g=s[i]+" "+s[i+1]+" "+s[i+2];p.hasOwnProperty(g)&&(e=p[g])}return(m.hasOwnProperty(o)||m.hasOwnProperty(n))&&(e+=l),e}},{key:"never_check",value:function(e,s,i,r){return 0===i&&h([s[r-1]])&&(e*=d),1===i&&("never"!==s[r-2]||"so"!==s[r-1]&&"this"!==s[r-1]?h([s[r-(i+1)]])&&(e*=d):e*=1.5),2===i&&("never"===s[r-3]&&("so"===s[r-2]||"this"===s[r-2])||"so"===s[r-1]||"this"===s[r-1]?e*=1.25:h([s[r-(i+1)]])&&(e*=d)),e}},{key:"punctuation_emphasis",value:function(s,i){return e.amplify_ep(i)+e.amplify_qm(i)}},{key:"amplify_ep",value:function(e){var s=e.replace(/[^!]/g,"").length;return s>4&&(s=4),.292*s}},{key:"amplify_qm",value:function(e){var s=e.replace(/[^?]/g,"").length,i=0;return s>1&&(i=s<=3?.18*s:.96),i}},{key:"sift_sentiment_scores",value:function(e){for(var s=0,i=0,r=0,t=0;t<e.length;t++){var n=e[t];n>0?s+=n+1:n<0?i+=n-1:r+=1}return[s,i,r]}},{key:"score_valence",value:function(s,i){if(s&&s.length>0){for(var r=0,t=0;t<s.length;t++)r+=s[t];var n=e.punctuation_emphasis(r,i);r>0?r+=n:r<0&&(r-=n);var a=f(r),l=e.sift_sentiment_scores(s),o=l[0],d=l[1],u=l[2];o>Math.abs(d)?o+=n:o<Math.abs(d)&&(d-=n);var c=o+Math.abs(d)+u,g=Math.abs(o/c),m=Math.abs(d/c),p=Math.abs(u/c);return{neg:parseFloat(m.toFixed(3)),neu:parseFloat(p.toFixed(3)),pos:parseFloat(g.toFixed(3)),compound:parseFloat(a.toFixed(4))}}return{neg:0,neu:0,pos:0,compound:0}}}]),e}()},function(e,s,i){"use strict";Object.defineProperty(s,"__esModule",{value:!0});var r=i(1);s.default=r.SentimentIntensityAnalyzer}]).default;
},{}],6:[function(require,module,exports){

},{}],7:[function(require,module,exports){
(function (process){
// .dirname, .basename, and .extname methods are extracted from Node.js v8.11.1,
// backported and transplited with Babel, with backwards-compat fixes

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function (path) {
  if (typeof path !== 'string') path = path + '';
  if (path.length === 0) return '.';
  var code = path.charCodeAt(0);
  var hasRoot = code === 47 /*/*/;
  var end = -1;
  var matchedSlash = true;
  for (var i = path.length - 1; i >= 1; --i) {
    code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        if (!matchedSlash) {
          end = i;
          break;
        }
      } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) return hasRoot ? '/' : '.';
  if (hasRoot && end === 1) {
    // return '//';
    // Backwards-compat fix:
    return '/';
  }
  return path.slice(0, end);
};

function basename(path) {
  if (typeof path !== 'string') path = path + '';

  var start = 0;
  var end = -1;
  var matchedSlash = true;
  var i;

  for (i = path.length - 1; i >= 0; --i) {
    if (path.charCodeAt(i) === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          start = i + 1;
          break;
        }
      } else if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // path component
      matchedSlash = false;
      end = i + 1;
    }
  }

  if (end === -1) return '';
  return path.slice(start, end);
}

// Uses a mixed approach for backwards-compatibility, as ext behavior changed
// in new Node.js versions, so only basename() above is backported here
exports.basename = function (path, ext) {
  var f = basename(path);
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};

exports.extname = function (path) {
  if (typeof path !== 'string') path = path + '';
  var startDot = -1;
  var startPart = 0;
  var end = -1;
  var matchedSlash = true;
  // Track the state of characters (if any) we see before our first dot and
  // after any path separator we find
  var preDotState = 0;
  for (var i = path.length - 1; i >= 0; --i) {
    var code = path.charCodeAt(i);
    if (code === 47 /*/*/) {
        // If we reached a path separator that was not part of a set of path
        // separators at the end of the string, stop now
        if (!matchedSlash) {
          startPart = i + 1;
          break;
        }
        continue;
      }
    if (end === -1) {
      // We saw the first non-path separator, mark this as the end of our
      // extension
      matchedSlash = false;
      end = i + 1;
    }
    if (code === 46 /*.*/) {
        // If this is our first dot, mark it as the start of our extension
        if (startDot === -1)
          startDot = i;
        else if (preDotState !== 1)
          preDotState = 1;
    } else if (startDot !== -1) {
      // We saw a non-dot and non-path separator before our dot, so we should
      // have a good chance at having a non-empty extension
      preDotState = -1;
    }
  }

  if (startDot === -1 || end === -1 ||
      // We saw a non-dot character immediately before the dot
      preDotState === 0 ||
      // The (right-most) trimmed path component is exactly '..'
      preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return '';
  }
  return path.slice(startDot, end);
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":8}],8:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[1]);
