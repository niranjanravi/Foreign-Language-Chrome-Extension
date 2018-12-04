$(document).ready(function() {
    chrome.storage.sync.get("nativelangs", function(obj) {
        if (obj.nativelangs != null) {
            for (var i=0; i<obj.nativelangs.length; i++) {
                $('#' + obj.nativelangs[i]).prop("checked", true);
            }
        }
    });

    document.getElementById("submitPrefs").addEventListener("click", function(form) {
        var checked = [];
        $("input:checked").each(function () {
            var id = $(this).attr("id");
            checked.push(id);
        });
        chrome.storage.sync.set({'nativelangs': checked}, function() {
            console.log('checkedBags stored');
        });
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.update(tabs[0].id, {url: tabs[0].url});
        });
        window.close();
    })
})