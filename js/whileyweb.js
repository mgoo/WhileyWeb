// Global reference to the code editor.
var editor;
var examples = [
    // Hello World
    "import std::io\nimport std::ascii\n\nmethod main():\n    io::println(\"hello world\")",
    // Absolute Function
    "function abs(int x) -> (int r)\nensures r >= 0\nensures (r == x) || (r == -x):\n    //\n    if x >= 0:\n        return x\n    else:\n        return -x",
    // IndexOf Function
    "type nat is (int x) where x >= 0\n\nfunction indexOf(int[] items, int item) -> (int r)\n// If valid index returned, element matches item\nensures r >= 0 ==> items[r] == item\n// If invalid index return, no element matches item\nensures r <  0 ==> all { i in 0..|items| | items[i] != item }\n// Return value is between -1 and size of items\nensures r >= -1 && r < |items|:\n    //\n    nat i = 0\n    while i < |items|\n        where all { k in 0 .. i | items[k] != item }:\n        //    \n        if items[i] == item:\n            return i\n        i = i + 1\n    //\n    return -1"
];

/**
 * Add a new message to the message list above the console.
 */
function addMessage(message_class, message_text, callback) {
    var message = $("<div></div>");
    message.text(message_text);
    message.addClass("message");
    message.addClass(message_class);
    message.appendTo("#messages");
    message.slideDown();
}

/**
 * Remove all messages from the message list above the console.
 */
function clearMessages() {
    $("#messages").children().remove();
}

/**
 * Display all the compilation errors.
 */
function showErrors(errors) {
    clearErrors();
    for(var i=0;i!=errors.length;++i) {
		var error = errors[i];
        markError(error);
    }
}

/**
 * Add an appropriate marker for a given JSON error object, as
 * returned from the server.
 */
function markError(error) {
    var errorText = error.text.replace("\\n","\n");
    if(error.counterexample) {
	errorText = errorText + "\n\ncounterexample: " + error.counterexample;
    }
    //
    if(error.start !== "" && error.end !== "" && error.line !== "") {
	// First, add error markers
        editor.getSession().setAnnotations([{
            row: error.line - 1,
            column: error.start,
            text: errorText,
            type: "error"
        }]);
	underScoreError(error,"error-message","error");
	// Second, add context markers (if any)
	for (var i = 0; i < error.context.length; i++) {
	    underScoreError(error.context[i],"context-message","error");
	}
    } else {
        addMessage("error", errorText);
    }
}

function underScoreError(error,kind,message) {
    var range = new ace.Range(error.line-1, error.start, error.line-1, error.end+1);
    editor.markers.push(editor.getSession().addMarker(range, kind, message, false));
}

/**
 * Clear all the compilation errors.
 *
 * Clear all markers (including those in the gutter) from the editor.
 * This is to prevent markers from a previous compilation from hanging
 * around.
 */
function clearErrors() {
    editor.getSession().clearAnnotations();
    for (var i = 0; i < editor.markers.length; i++) {
        editor.getSession().removeMarker(editor.markers[i]);
    }
    editor.markers = [];
}

/**
 * Compile a given snippet of Whiley code.
 */
function compile() {
    var console = document.getElementById("console");
    // binArea is where generated JavaScript is place
    var binArea = document.getElementById("bin");
    // Get configuration flags
    var verify = document.getElementById("verification");
    var counterexamples = document.getElementById("counterexamples");
    // Construct request
    var request = {
        code: editor.getValue(),
        verify: verify.checked,
        counterexamples: counterexamples.checked
    };
    // Attempt to stash the current state
    store(request);
    //
    $.post(root_url + "/compile", request, function(response) {
        clearMessages();
        console.value = "";
        $("#spinner").hide();
        var response = $.parseJSON(response);
        if(response.result == "success") {
            // Store generated JavaScript in binary area
            binArea.value = response.js;
            // Enable run button
             enableRunButton(true);
             // Clear all error markers
            clearErrors(true);
            // Show green success message
            addMessage("success", "Compiled successfully!");
        } else if(response.result == "errors") {
            var errors = response.errors;
            // Clear any generated JavaScript from binary area
            binArea.value = "";
            // Disable run button
            enableRunButton(false);
            // Display error message markers
            showErrors(errors);
            // Show error message itself
            errors.forEach(function (error) {
              addMessage("error", "Compilation failed: " + error.text.replace("\\n","\n"));
            });
        } else if(response.result == "exception") {
            addMessage("error", "Internal failure: " + response.text);
        }
    });
    $("#spinner").show();
}

function println_n6string(str) {
    var console = document.getElementById("console");
    console.value = str;
}

/**
 * Compile and run a given snippet of Whiley code.
 */
function run() {
    var bin = document.getElementById("bin");
    var console = document.getElementById("console");
    eval(bin.value);
    eval("main();");
}

/**
 * Save a given snippet of Whiley code.
 */
function save() {
   
}

/**
 * Toggle display of generated JavaScript.
 */
function showConsole(enable) {
    document.getElementById("showConsole").checked = enable;    
    if(enable) {
	document.getElementById("console").style.display = "block";
    } else {
	document.getElementById("console").style.display = "none";
    }
}

/**
 * Toggle display of generated JavaScript.
 */
function showJavaScript(enable) {
    document.getElementById("showJavaScript").checked = enable;
    if(enable) {
	document.getElementById("bin").style.display = "block";
    } else {
	document.getElementById("bin").style.display = "none";
    }
}

function showExample(eg) {
    editor.setValue(examples[eg]);
}

/**
 * Enable or disable run button
 */
function enableRunButton(enable) {
    document.getElementById("run").disabled = !enable;
}

/**
 * Attempt to store from local storage
 */
function restore(defaultCode) {
    if (typeof(localStorage) !== "undefined" && localStorage.getItem("whileylabs")) {
	// Code for localStorage/sessionStorage.
	return JSON.parse(localStorage.getItem("whileylabs"));
    } else {
	// No Storage support..
	return {code: examples[0], verify: false};
    }
}

/**
 * Save the current state in localstorage
 */
function store(request) {
    if (typeof(localStorage) !== "undefined") {
	// Code for localStorage/sessionStorage.
	localStorage.setItem("whileylabs",JSON.stringify(request));
    } else {
	// No Storage support..
    }
}

// Run this code when the page has loaded.
$(document).ready(function() {
    ace.require("ace/ext/language_tools");
    ace.Range = require('ace/range').Range;
    // Enable the editor with Whiley syntax.
    editor = ace.edit("code");
    var WhileyMode = require("ace/mode/whiley").Mode;
    editor.getSession().setMode(new WhileyMode());
    editor.setTheme("ace/theme/eclipse");
    editor.setFontSize("10pt");
    editor.setBehavioursEnabled(false);
    editor.setHighlightActiveLine(false);
    editor.setShowFoldWidgets(false);
    editor.setShowPrintMargin(false);
    editor.setAutoScrollEditorIntoView(true);
    editor.getSession().setUseSoftTabs(true);
    editor.getSession().setTabSize(4);
    editor.markers = [];
    editor.setOptions({
        enableBasicAutocompletion: true
    });
    editor.on("input", function() {
        clearErrors();
        clearMessages();
    });

    var staticWordCompleter = {
        getCompletions: function(editor, session, pos, prefix, callback) {
            var wordList = require("ace/mode/whiley").keywords;
            callback(null, wordList.map(function(word) {
                return {
                    caption: word,
                    value: word,
                    meta: "static"
                };
            }));
        }
    };
    editor.completers = [staticWordCompleter];

    $("#code").resizable({
        resize: function() {
            editor.resize();
        },
        handles: "s",
        cursor: "default",
        minHeight: $("#code").height()
    });
    // Disable run button
    enableRunButton(false);
    // Hide Console and JavaScript areas
    showConsole(false);
    showJavaScript(false);
    // Attempt to restore from previous state
    var previousState = restore("Write code here...");
    var verifyCheckBox = document.getElementById("verification");
    editor.setValue(previousState.code);
    verifyCheckBox.checked = previousState.verify;
});
