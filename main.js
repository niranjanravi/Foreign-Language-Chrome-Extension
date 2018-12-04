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

//const nlp = spacyNLP.nlp;

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
    // var id = elt.find('._43f9._63qh a ~ span')[0]["id"]
    id = id.match(/\d{15}/g).slice(-1)[0];
    // id = id.match(/\d{16}/g)[0]
    return id;
}

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

  // $("._khz").click(function (event) {
  //   console.log('LIKE');
  //   var fbIdClick = getFbId($(event.target).closest("._5pcr"));
  //   if (analyzedFbId.has(fbIdClick)) {
  //     var logBlob = {
  //       time: Date.now() - 18000000,
  //       postID: fbIdClick.substring(5),
  //       like: 1
  //     };
  //     var payLoad = {
  //       name: myName,
  //       logBlob: logBlob
  //     };
  //     chrome.runtime.sendMessage(payLoad, function(response){});
  //   }
  // });

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
      // console.log("Before translation: " + content);

      //if language is english, don't run through google translate
      if (language == "en"){
        translatedText = content;
        translatedText = translatedText.replace(/See Translation/i, "");
        translatedText = translatedText.replace(/See More/i, "");

          if (!linkSection) {
            translatedTextOrig = translatedText; // store translation of original user content
            translatedTextFull = translatedText;
            if (nativeLang.indexOf('en') > -1) {
              $("#translation-box").html("<div id='translationToggle'><h2 style='color:white; margin-bottom:4px; margin-top:15px; background-color: #3b5998; border-radius: 4px; text-align:center; padding:2px;'> Translation </h2></div><div id=\'white-box\'></div><br>");
            } else {
              $("#translation-box").html("<div id='translationToggle'><h2 style='color:white; margin-bottom:4px; margin-top:15px; background-color: #3b5998; border-radius: 4px; text-align:center; padding:2px;'> Text </h2></div><div id=\'white-box\'></div><br>");
            }
            $("#white-box").css('overflow-y', 'auto');
            $("#white-box").css('align-items', 'stretch');
            $("#white-box").css('max-height', '200px');
            $("#white-box").css('background-color', 'white');
            $("#white-box").css('height', 'auto');
            $("#white-box").css('padding', '10px');
            $("#white-box").css('width', 'calc(100% - 20px)');
            $("#white-box").css('word-wrap', 'break-word');
            $("#white-box").css('display', 'inline-block');
          } else {
            translatedTextFull += " " + translatedText;
          }


          // nlp.parse(translatedText).then(output => {
          //   console.log(output[0].noun_phrases);
          // })

          if (textrazorSupported.indexOf(language) >= 0) {
            // run entity analysis in original language, if supported
            langCode = textrazorCodes[textrazorSupported.indexOf(language)];
            runEntityAnalysis(content, langCode, linkSection);
          } else {
            // otherwise run analysis on translation
            runEntityAnalysis(translatedText, "eng", linkSection);
          }
          // run emotion analysis only on user content
        //   if (!linkSection) {
        //     runEmotionAnalysis(translatedText, content);
        //   }
      }
      else{ //if language is not english

        var translateButton = getTranslationButton();

        console.log(content);

        if(containsTranslationButton()){
            translateButton.click();
            addHoverBox();
            createButton();
            addTranslationBox();
        }
        
        
        setTimeout(function(){
            var postParent = getPostDiv();
            console.log(postParent);
            var translationDiv = $("._5wpt ._50f4 div", postParent)[0];
            console.log(translationDiv);
            var translatedText = translationDiv.textContent;

            translatedText = translatedText.replace(/See Translation/i, "");
            translatedText = translatedText.replace(/See More/i, "");

            console.log("After translation: " + translatedText);

            const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(translatedText);
            console.log("Intensity of Translation: " + intensity.compound);

            if (!linkSection) {
              translatedTextOrig = translatedText; // store translation of original user content
              translatedTextFull = translatedText;
              console.log("about to add the thing");
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
              console.log("Added the thing");
              
              runEntityAnalysis(translatedText, "eng");

              runEmotionAnalysis(translatedText);
            } else {
              console.log("link section");
              translatedTextFull += " " + translatedText;
            }
        }, 1000);

        //   $.get(translateUrl + content, function(data) {
        //   translatedText = data.data.translations[0].translatedText;
        //   // console.log("After translation: " + translatedText);
      }
    }

    function clickButton(content) {
      $(".btn-class").on("click", function() {
        analyzedFbId.add(fbId);
        postId = fbId;

        uniqueEntities = [];
        console.log("About to add translation box");
        if(!containsTranslationButton()){
          addTranslationBox();
        }
        //addTranslationBox();
        translateText(main, language1, false);
      });
    }

    var parent; 
    function containsTranslationButton(){
      var origLink =  $('a._5pcq[href*="' + fbId +'"]')[0];
      parent = origLink.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.parentElement;
      var links = $("._43f9._63qh", parent);
      return links.length > 0;
    }

    function getTranslationButton(){
      if(containsTranslationButton()){
        var span = $("._43f9._63qh a", parent)[0];
        return span.previousSibling;
      }
    }

    function detectLanguage(content) {
      //console.log("FB ID:", fbId);
      // var translateButton = getTranslationButton();
      // translateButton.click(function(){
      //   addHoverBox();
      //   createButton();
      //   addTranslationBox();
      //   translateText(main, language1, false);
      // });
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
        // if ($("#white-box2").text() == '') {
         
        // }
        $("#white-box2").css('display', 'inline-block');
        $("#white-box2").css('width', 'calc(100% - 20px)');
        //$("#white-box2").hide();
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
      //$("#white-box2").slideToggle();


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
              analysis += "<span style='margin:auto'><span style='font-size:14px'><b>" + entity + "</b></span><br></span>";
              analysis += "<p>No corresponding Wikipedia article found</p>";
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

      // $("#entityToggle").click(function(){
        
      // });

      var hasEntity = false;
      // $.ajax({
      //   url: "https://api.textrazor.com",
      //   type: "POST",
      //   headers: {
      //     "X-TextRazor-Key": textRazorKey3
      //   },
      //   data: {
      //     text: content,
      //     extractors: "entities",
      //     languageOverride: langCode,
      //   },
      //   success: function(res) {
      //     // only add label and box for entity analysis once
          

      //     // if entities detected, replace matched text in translation with entity object
      //     var entitiesArray = []; // separate for user content and link content
      //     if (res.response.hasOwnProperty("entities")) {
      //       // build array of entities
      //       for (var i = 0; i < res.response.entities.length; i++) {
      //         var type = res.response.entities[i].type;
      //         // don't include entities of the following types
      //         if ((type != undefined) && res.response.entities[i].confidenceScore > .5 ||
      //           res.response.entities[i].wikiLink.length > 0) {
      //           if ((type != undefined) && !(type[0] == "Number" || type[0] == "Money" || type[0] == "Email" ||
      //               type[0] == "URL" || type[0] == "Duration" || type[0] == "Date" ||
      //               type[0] == "Time" || type[0] == "Ordinal" || type[0] == "Percentage" ||
      //               type[0] == "Temperature" || type[0] == "Distance" || type[0] == "TimePeriod")) {
      //             entitiesArray.push(res.response.entities[i]);
      //           } else if (type == undefined) {
      //             entitiesArray.push(res.response.entities[i]);
      //           }
      //         }
      //       }
            
      //       // build arrays of matched words and entities
      //       var push;
      //       var translation; // english version of matched text for single entity
      //       for (var i = 0; i < entitiesArray.length; i++) {
      //         push = true;
      //         var matchedText = String(entitiesArray[i]["matchedText"]).replace(/#/g, "").replace(/&/g, "");
      //         if (matchedText.indexOf("<") >= 0) {
      //           matchedText = matchedText.substr(0, matchedText.indexOf("<"));
      //         }
      //         $.get(translateUrl + matchedText, function(data) {
      //           // if foreign text is not directly in translation, use translation of matched text
      //           if (textrazorSupported.indexOf(linkSection ? language2 : language1) >= 0 &&
      //             translatedText.toLowerCase().indexOf(matchedText.toLowerCase()) < 0) {
      //             translation = data.data.translations[0].translatedText;
      //           } else {
      //             translation = matchedText;
      //           }
      //           // if one is contained within the other, don't include shorter one
      //           // && translatedText.toLowerCase().indexOf(translation.toLowerCase()) >= 0
      //           if (matchedWords.length > 0) {
      //             for (var j = 0; j < matchedWordsLower.length; j++) {
      //               if (matchedWordsLower[j].indexOf(translation.toLowerCase()) >= 0 || translation.toLowerCase().indexOf(matchedWordsLower[j]) >= 0) {
      //                 if (matchedWordsLower[j].length < translation.length) {
      //                   matchedWords.splice(j, 1);
      //                   matchedWordsLower.splice(j, 1);
      //                   selectedEntities.splice(j, 1);
      //                 } else {
      //                   push = false;
      //                 }
      //               }
      //             }
      //             // prevent duplicates
      //             if (matchedWordsLower.indexOf(translation.toLowerCase()) < 0 && push) {
      //               matchedWords.push(translation);
      //               matchedWordsLower.push(translation.toLowerCase());
      //               selectedEntities.push(entitiesArray[i]);
      //             }
      //           } else {
      //             matchedWords.push(translation);
      //             matchedWordsLower.push(translation.toLowerCase());
      //             selectedEntities.push(entitiesArray[i]);
      //           }
      //         });
      //       }

      //       // highlight matched text in translation,
      //       // only if link content entities have already been included or no link content 
      //       if (linkSection || linkText.length == 0) {
      //         // build array of entity information for log
      //         allEntities = [];
      //         var json;
      //         var entityType;
      //         selectedEntityTypes = [];

      //         for (var i = 0; i < selectedEntities.length; i++) {
      //           entityType = String(selectedEntities[i]["type"]).replace(/([A-Z])/g, ' $1').trim();
      //           selectedEntityTypes.push(entityType);
      //           json = '{ "matchedText": "' + selectedEntities[i]["matchedText"] + '", ';
      //           json += '"type": "' + entityType + '", ';
      //           json += '"wikiLink": "' + selectedEntities[i]["wikiLink"] + '" }';
      //           allEntities.push(JSON.parse(json));
      //         }

      //         // highlight matched text in translation
      //         if (linkSection && $("#white-box").text().length > 0) {
      //           var newText = translatedTextOrig + "<hr><p><b>Link:</b></p>" + translatedText;
      //         } else if (linkSection) {
      //           var newText = translatedTextOrig + "<hr><p><b>Link:</b></p>" + translatedText;
      //         } else {
      //           var newText = translatedTextOrig;
      //         }
      //         // replace matched words with unique entity id
      //         var entityIds = [];
      //         var orderedMatches = [];
      //         for (var i = 0; i < matchedWords.length; i++) {
      //           var regex = new RegExp(matchedWords[i].replace(".", "/."), 'ig'); // case insensitive search
      //           if (newText.match(regex) != null) {
      //             var index = 0;
      //             var count = newText.match(regex).length;
      //             for (var j = 0; j < count; j++) {
      //               // create unique id for each highlighted text
      //               var entityId = matchedWords[i].replace(/&#,'"[<>\\+$~%*{}]/g, "").replace(/ /g, "").toLowerCase() + String(i * 10 + j);
      //               entityIds.push(entityId);
      //               orderedMatches.push(matchedWords[i]);
      //               if (uniqueEntities.indexOf(matchedWords[i]) < 0) {
      //                 uniqueEntities.push(matchedWords[i]);
      //               }
      //               // index is index of next occurrence
      //               index = newText.toLowerCase().indexOf(matchedWords[i].toLowerCase(), index);
      //               newText = newText.substring(0, index) + entityId +
      //                 newText.substring(index + matchedWords[i].length);
      //               index = index + entityId.length; // end of last replacement
      //             }
      //           }
      //         }
      //         // replace entity ids with highlighted text
      //         for (var i = 0; i < entityIds.length; i++) {
      //           var highlighted = "<a href='#'><mark class='entity' id=" + entityIds[i] +
      //             " style='background-color: #ffb3b3; opacity: .75;'>" + orderedMatches[i] + "</mark></a>";
      //           newText = newText.replace(entityIds[i], highlighted);
      //         }

      //         if (entityIds.length > 0) {
      //           hasEntity = true;
      //         }
      //         if (linkSection) {
      //           cleanText = translatedTextOrig + "<hr><p><b>Link:</b></p>" + translatedText;
      //         } else {
      //           cleanText = translatedText;
      //         }
      //         $("#white-box").empty();
      //         $("#white-box").append(cleanText);

      //         if (linkText.length === 0 &&
      //           (document.getElementsByClassName("entity").length === 0 || selectedEntities.length === 0)) {}
      //         if (linkText !== "" && linkSection &&
      //           (document.getElementsByClassName("entity").length === 0 || selectedEntities.length === 0)) {}

      //         function entityClick() { // display single entity
      //           $(".entity").unbind().click(function() {
      //             var clickedEntity = $(this).text();
      //             // change highlight color of other entities back to red
      //             var entities = document.getElementsByClassName("entity");
      //             for (var i = 0; i < entities.length; i++) {
      //               if (entities[i] !== this) {
      //                 $(entities[i]).css('background-color', '#ffb3b3');
      //                 $(entities[i]).css('opacity', '0.75');
      //               }
      //             }
      //             // highlight clicked entity yellow
      //             $(this).css('background-color', '#ffff80');
      //             $(this).css('opacity', '0.5');

      //             // build analysis portion of entity
      //             
      //             wikiText = "";
      //             var wikiImg = "";
      //             // search matchedWords until entity found
      //             var k = 0;
      //             var entityFound = false;
      //             while (k < matchedWords.length && !entityFound) {
      //               var currentEntity = selectedEntities[k];
      //               if (matchedWords[k].toLowerCase() == clickedEntity.toLowerCase()) {
      //                 // log clicked entity
      //                 var json;
      //                 json = '{ "matchedText": "' + currentEntity["matchedText"] + '", ';
      //                 json += '"type": "' + selectedEntityTypes[k] + '" } ';
      //                 var clicked = JSON.parse(json);
      //                 var logBlob = {
      //                   time: Date.now() - 18000000,
      //                   postID: postId.substring(5),
      //                   clickedEntity: clicked,
      //                 };
      //                 var payLoad = {
      //                   name: myName,
      //                   logBlob: logBlob
      //                 };
      //                 chrome.runtime.sendMessage(payLoad, function(response){});

      //                 } else { // if no wikiLink, add Google search button
      //                   var link = "https://www.google.com/search?q=" +
      //                     matchedWords[k].replace(/[&\\#,+'"()$=~%*{}]/g, ' ').split(' ').join('+');
      //                   analysis += '</span><br><input type="button" value="Google Search" class="googlebutton" onclick="window.open(\'' + link + '\')" ';
      //                   analysis += 'style="font-size:14px; font-weight:bold; background-color:#e5e5e5; border-radius:2px; border:1px solid #e4e4e4; color:#666; padding:10px; cursor:pointer;" onMouseOver="this.style.color=\'#333\'; this.style.background=\'#f5f5f5\'" onMouseOut="this.style.background=\'#e4e4e4\'; this.style.color=\'#666\'" />';
      //                 }
      //               }
      //               k++;
      //             }

      //           });
      //         }
      //       }
      //     }
      //     if (!hasEntity && (linkSection || linkText.length == 0)) {
      //       $("#white-box2").html("<p style='text-align:left'>No keywords detected.</p>");
      //     }
      //     var hidden = 1;
      //     //only call this section once per click
      //     if (linkSection) {
      //       cleanText = translatedTextOrig + "<hr><p><b>Link:</b></p>" + translatedText;
      //     } else {
      //       cleanText = translatedText;
      //     }
      //     $("#white-box").empty();
      //     $("#white-box").append(cleanText);
      //     //slide entity box down when toggle is clicked only once
      //     if (linkSection || linkText.length == 0) {
      //       $("#entityToggle").unbind().click(function() {
      //         // log button click
      //         var logBlob = {
      //           time: Date.now() - 18000000,
      //           postID: postId.substring(5),
      //           buttonClicked: "entity"
      //         };
      //         var payLoad = {
      //           name: myName,
      //           logBlob: logBlob
      //         };
      //         chrome.runtime.sendMessage(payLoad, function(response){});

      //         $("#white-box2").slideToggle();
      //         hidden++;
      //         if (hidden % 2 == 0) { //change text when white-box2 is visible (even)
      //           $("#white-box").empty();
      //           if (newText) { //if newText exists
      //             $("#white-box").append(newText); //change to translatedText
      //             entityClick(); //get functionality for .entity clicks
      //           } else {
      //             $("#white-box").append(cleanText);
      //           }
      //         } else {
      //           $("#white-box").empty(); //remove previous text
      //           $("#white-box").append(cleanText); //change to highlightedText
      //         }
      //       });
      //     }

      //   },
      //   error: function(err) {
      //     $("#white-box").html("<p>Error. Please try again!</p>");
      //   }
      // });
    }

    var emotionAnalysisDone = false;
    function runEmotionAnalysis(translatedText) {
        const vader = require('vader-sentiment');
        const intensity = vader.SentimentIntensityAnalyzer.polarity_scores(translatedText);

      //If it is not one of supported language, call once.
        $("#translation-box").append("<div id='emToggleContainer'><div id='emotionToggle'><h2 id='entity-label' style='color: white; margin-bottom: 4px; margin-top: 5px;background-color: #3b5998; border-radius: 4px; text-align:center; padding:2px;cursor:pointer;'onMouseOver=\"this.style.background=\'#486ebe\'\" onMouseOut=\"this.style.background=\'#3b5998\'\"> Emotion Analysis </h2></div><div id='eQuestion' style='color:gray; display:inline-block'>?</div></div><div id=\'emInfo\'></div>");

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
            //$("#translation-box").append("<h2>Sentiment Analysis </h2>");
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
        } else {
            $("#white-box3").slideToggle();
        }

        // $("#emotionToggle").click(function() {

            
        // });
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