/**
 * Growl for dojoJs
 * http://github.com/zir/ext-growl
 *
 * Ported from:
 *
 * Gritter for jQuery
 * http://www.boedesign.com/
 *
 * Copyright (c) 2009 Jordan Boesch
 * Dual licensed under the MIT and GPL licenses.
 *
 * Date: December 1, 2009
 * Version: 1.6
 */

;
(function(){

    /**
	* Set it up as an object under the dojoJs namespace
	*/
    dojo.gritter = {};

    /**
	* Set up global options that the user can over-ride
	*/
    dojo.gritter.options = {
        fade_in_speed: .4, // how fast notifications fade in
        fade_out_speed: 1, // how fast the notices fade out
        time: 2000 // hang on the screen for...
    }

    /**
	* Add a gritter notification to the screen
	* @see Gritter#add();
	*/
    dojo.gritter.add = function(params){

        try {
            return Gritter.add(params || {});
        } catch(e) {
    
            var err = 'Gritter Error: ' + e;
            (typeof(console) != 'undefined' && console.error) ?
            console.error(err, params) :
            alert(err);
    
        }

    }

    /**
	* Remove a gritter notification from the screen
	* @see Gritter#removeSpecific();
	*/
    dojo.gritter.remove = function(id, params){
        Gritter.removeSpecific(id, params || {});
    }

    /**
	* Remove all notifications
	* @see Gritter#stop();
	*/
    dojo.gritter.removeAll = function(params){
        Gritter.stop(params || {});
    }

    /**
	* Big fat Gritter object
	* @constructor (not really since it's object literal)
	*/
    var Gritter = {

        // Public - options to over-ride with dojo.gritter.options in "add"
        fade_in_speed: '',
        fade_out_speed: '',
        time: '',

        // Private - no touchy the private parts
        _custom_timer: 0,
        _item_count: 0,
        _is_setup: 0,
        _tpl_close: '<div class="gritter-close"></div>',
        _tpl_item: '<div id="gritter-item-[[number]]" class="gritter-item-wrapper [[item_class]]" style="opacity:0"><div class="gritter-top"></div><div class="gritter-item">[[image]]<div class="[[class_name]]"><span class="gritter-title">[[username]]</span><p>[[text]]</p></div><div style="clear:both"></div></div><div class="gritter-bottom"></div></div>',
        _tpl_wrap: '<div id="gritter-notice-wrapper"></div>',

        /**
		* Add a gritter notification to the screen
		* @param {Object} params The object that contains all the options for drawing the notification
		* @return {Integer} The specific numeric id to that gritter notification
		*/
        add: function(params){

            // We might have some issues if we don't have a title or text!
            if(!params.title || !params.text){
                throw 'You need to fill out the first 2 params: "title" and "text"';
            }

            // Check the options and set them once
            if(!this._is_setup){
                this._runSetup();
            }

            // Basics
            var user = params.title,
            text = params.text,
            image = params.image || '',
            sticky = params.sticky || false,
            item_class = params.class_name || '',
            time_alive = params.time || '';

            this._verifyWrapper();

            this._item_count++;
            var number = this._item_count,
            tmp = this._tpl_item;

            // Assign callbacks
            dojo.forEach(['before_open', 'after_open', 'before_close', 'after_close'], function(val){
                Gritter['_' + val + '_' + number] = (dojo.isFunction(params[val])) ? params[val] : function(){}
            });

            // Reset
            this._custom_timer = 0;

            // A custom fade time set
            if(time_alive){
                this._custom_timer = time_alive;
            }

            var image_str = (image != '') ? '<img src="' + image + '" class="gritter-image" />' : '',
            class_name = (image != '') ? 'gritter-with-image' : 'gritter-without-image';

            // String replacements on the template
            tmp = this._str_replace(
                ['[[username]]', '[[text]]', '[[image]]', '[[number]]', '[[class_name]]', '[[item_class]]'],
                [user, text, image_str, this._item_count, class_name, item_class], tmp
                );

            this['_before_open_' + number]();
            dojo.place(tmp, 'gritter-notice-wrapper', 'last');

            var itemId = 'gritter-item-' + this._item_count;
            var item = dojo.byId(itemId);

            var fadeIn = dojo.fadeIn({
                node: item
                ,
                duration: this.fade_in_speed*1000
            });
            dojo.connect(fadeIn.play(), 'onEnd', function() {
                Gritter['_after_open_' + number](item);
            });

            if(!sticky){
                this._setFadeTimer(item, number);
            }
            var self = this;
            var links = Gritter['_event_id_' + number] = [];

            // Bind the hover/unhover states
            links.push(
                dojo.connect(item, 'mouseover', function(event){
                    //item.fadeOut({duration: Gritter.fade_out_speed, endOpacity: 0, remove: true});
                    if (!sticky) {
                        clearTimeout(self['_int_id_' + number]);
                        var fadeOutId = '_fadeout_id_' + number;
                        if (fadeOutId in Gritter) {
                            Gritter[fadeOutId].stop();
                            dojo.style(item, {
                                opacity: 1
                            });
                        }
                    }
                    dojo.addClass(item, 'hover');
                    // Insert the close button as the first child of notice el
                    dojo.place(self._tpl_close,  item, 'first');

                    // Clicking (X) makes the perdy thing close
                    dojo.query('.gritter-close').onclick(function(){
                        var unique_id = item.id.split('-')[2];
                        self.removeSpecific(unique_id, {}, item, true);
                    });
                }));
            links.push(
                dojo.connect(item, 'mouseleave', function(event) {
                    sticky || Gritter._setFadeTimer(item, number);
                    dojo.removeClass(item, 'hover');
                    dojo.forEach(dojo.query('.gritter-close'), function(e) {
                        dojo.destroy(e);
                    });
                }));

            return number;

        },

        /**
		* If we don't have any more gritter notifications, get rid of the wrapper using this check
		* @private
		* @param {Integer} unique_id The ID of the element that was just deleted, use it for a callback
		* @param {Object} e The dojoJs element that we're going to perform the remove() action on
		*/
        _countRemoveWrapper: function(unique_id, e){

            // Remove it then run the callback function
            e && dojo.destroy(e);
            this['_after_close_' + unique_id](e);
            // Check if the wrapper is empty, if it is.. remove the wrapper
            if(dojo.query('div.gritter-item-wrapper').length === 0){
                dojo.destroy('gritter-notice-wrapper');
            }

        },

        /**
		* Fade out an element after it's been on the screen for x amount of time
		* @private
		* @param {Object} e The dojoJs element to get rid of
		* @param {Integer} unique_id The id of the element to remove
		* @param {Object} params An optional list of params to set fade speeds etc.
		* @param {Boolean} unbind_events Unbind the mouseenter/mouseleave events if they click (X)
		*/
        _fade: function(e, unique_id, params, unbind_events){

            var params = params || {},
            fade = (typeof(params.fade) != 'undefined') ? params.fade : true,
            fade_out_speed = params.speed || this.fade_out_speed;

            this['_before_close_' + unique_id](e);

            // If this is true, then we are coming from clicking the (X)
            if(unbind_events){
                var links = Gritter['_event_id_' + unique_id];
                //e.removeAllListeners();
                dojo.forEach(links, function(e) {
                    dojo.disconnect(e);
                });
            }

            // Fade it out or remove it

            if(fade){
                var fadeOut = dojo.fadeOut({
                    node: e,
                    duration: fade_out_speed*1000
                    });
                Gritter['_fadeout_id_' + unique_id] = fadeOut; // save for stop
                dojo.connect(fadeOut.play(), 'onEnd', function() {
                    Gritter._countRemoveWrapper(unique_id, e);
                });
            }
            else {
                this._countRemoveWrapper(unique_id, e);
            }
        },

        /**
		* Remove a specific notification based on an ID
		* @param {Integer} unique_id The ID used to delete a specific notification
		* @param {Object} params A set of options passed in to determine how to get rid of it
		* @param {Object} e The dojoJs element that we're "fading" then removing
		* @param {Boolean} unbind_events If we clicked on the (X) we set this to true to unbind mouseenter/mouseleave
		*/
        removeSpecific: function(unique_id, params, e, unbind_events){

            if(!e){
                var e = dojo.byId('gritter-item-' + unique_id);
            }

            // We set the fourth param to let the _fade function know to
            // unbind the "mouseleave" event.  Once you click (X) there's no going back!
            this._fade(e, unique_id, params || {}, unbind_events);

        },

        /**
		* Setup the global options - only once
		* @private
		*/
        _runSetup: function(){

            for(var opt in dojo.gritter.options){
                this[opt] = dojo.gritter.options[opt];
            }
            this._is_setup = 1;

        },

        /**
		* Set the notification to fade out after a certain amount of time
		* @private
		* @param {Object} item The HTML element we're dealing with
		* @param {Integer} unique_id The ID of the element
		*/
        _setFadeTimer: function(e, unique_id){
            var timer_str = (this._custom_timer) ? this._custom_timer : this.time;
            this['_int_id_' + unique_id] = setTimeout(function(){
                Gritter._fade(e, unique_id);
            }, timer_str);
        },

        /**
		* Bring everything to a halt
		* @param {Object} params A list of callback functions to pass when all notifications are removed
		*/
        stop: function(params){

            // callbacks (if passed)
            var before_close = (dojo.isFunction(params.before_close)) ? params.before_close : function(){};
            var after_close = (dojo.isFunction(params.after_close)) ? params.after_close : function(){};

            var wrap = dojo.byId('gritter-notice-wrapper');
            before_close(wrap);
            var fadeOut = dojo.fadeOut({
                node:wrap
            });
            dojo.connect(fadeOut.play(), 'onEnd', function() {
                dojo.destroy(wrap);
            });
        },

        /**
		* An extremely handy PHP function ported to JS, works well for templating
		* @private
		* @param {String/Array} search A list of things to search for
		* @param {String/Array} replace A list of things to replace the searches with
		* @return {String} sa The output
		*/
        _str_replace: function(search, replace, subject, count){

            var i = 0, j = 0, temp = '', repl = '', sl = 0, fl = 0,
            f = [].concat(search),
            r = [].concat(replace),
            s = subject,
            ra = r instanceof Array, sa = s instanceof Array;
            s = [].concat(s);

            if(count){
                this.window[count] = 0;
            }

            for(i = 0, sl = s.length; i < sl; i++){

                if(s[i] === ''){
                    continue;
                }

                for (j = 0, fl = f.length; j < fl; j++){

                    temp = s[i] + '';
                    repl = ra ? (r[j] !== undefined ? r[j] : '') : r[0];
                    s[i] = (temp).split(f[j]).join(repl);

                    if(count && s[i] !== temp){
                        this.window[count] += (temp.length-s[i].length) / f[j].length;
                    }

                }
            }

            return sa ? s : s[0];

        },

        /**
		* A check to make sure we have something to wrap our notices with
		* @private
		*/
        _verifyWrapper: function(){

            if(!dojo.byId('gritter-notice-wrapper')){
                //dojo.DomHelper.append(document.body, {tag: 'div', id: 'gritter-notice-wrapper'});
                //dojo.byId(document.body).insertHtml('beforeEnd', this._tpl_wrap);
                //var body = dojo.query('body');
                dojo.place(this._tpl_wrap, document.body, 'last');
            }

        }

    }

})();