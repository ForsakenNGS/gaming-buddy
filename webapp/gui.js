gui = (function($) {

    let object = document.createElement("div");

    object.messageHandlers = {};
    object.pollMessagesRequest = null;
    object.pollMessages = function() {
        if (object.pollMessagesRequest !== null) {
            return;
        }
        object.pollMessagesRequest = $.post("/app/messageGet.json", function (result) {
            for (let i = 0; i < result.messages.length; i++) {
                $(object).trigger("message", result.messages[i]);
            }
        }).always(function() {
            object.pollMessagesRequest = null;
        });
    };
    object.sendMessage = function(...parameters) {
        return new Promise((resolve, reject) => {
            $.post("/app/messageSend.json", { parameters: parameters }, function (result) {
                resolve(result);
            }).fail(function() {
                reject();
            })
        });
    };
    object.renderElement = function(template, context, callback) {
        return new Promise((resolve, reject) => {
            $.post("/app/renderElement.json", { template: template, context: JSON.stringify(context) }, function (result) {
                resolve(result);
                callback(result);
            }).fail(function() {
                reject();
            })
        });
    };
    object.getStatus = function() {
        return new Promise((resolve, reject) => {
            $.post("/app/status.json", function (result) {
                resolve(result);
            }).fail(function() {
                reject();
            })
        });
    };
    object.handleMessage = function(pluginName, type, ...parameters) {
        if (pluginName == "core") {
            if (object.messageHandlers.hasOwnProperty(type)) {
                for (let i = 0; i < object.messageHandlers[type].length; i++) {
                    object.messageHandlers[type][i](...parameters);
                }
            }
        }
    };
    object.setPage = function(page, forceSwitch) {

    };
    object.on = function(messageType, callback) {
        if (!object.messageHandlers.hasOwnProperty(messageType)) {
            object.messageHandlers[messageType] = [];
        }
        object.messageHandlers[messageType].push(callback);
    };
    object.off = function(messageType, callback) {
        if (!object.messageHandlers.hasOwnProperty(messageType)) {
            return;
        }
        if (typeof callback == "undefined") {
            object.messageHandlers[messageType] = [];
        } else {
            let cbIndex = object.messageHandlers[messageType].indexOf(callback);
            if (cbIndex >= 0) {
                object.messageHandlers[messageType].splice(cbIndex, 1);
            }
        }
    };

    // Message callback
    $(object).on("message", function(event, ...message) {
        object.handleMessage(...message);
    });
    // Start polling messages
    window.setInterval(function() {
        object.pollMessages();
    }, 1000);

    // Default message handlers
    object.on("page.rendered", function(renderResult) {
        $(".page").html(renderResult.html);
    });

    return object;

})(jQuery);
