/**
 * Code written by Max Franz.
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA
 */

;(function($){
	
	var last_id = 0;
	
	$.fn.menucommandtip = function(opts, param1, param2, param3){
		
		if( typeof opts == "string" ){
			return $(this).commandtip( opts, param1, param2, param3 );
		}
		
		return this.each(function(){
			
			var id_postfix = "menu-command-" + last_id++;
			var id = "ui-tooltip-" + id_postfix;
			
			var defaults = {
				// array of menu items
				// e.g.
				// {
				//     name: "Do something", // name of menu item
				//     select: function(){ /* Do something on select */ },
				//     menuClose: false, // close on menu item select
				//     items: [] // array of sub menu items
				// }
				items: undefined,
				
				// content of the menucommandtip
				content: "",
				
				// id postfix for the menucommandtip: ui-tooltip-menu-command-${id}
				id: id_postfix,
				
				// whether to close the menucommandtip when clicking a menu item;
				// overridden by options.items[index].menuClose
				menuClose: true,
				
				// how fast to animate submenuitems when their parent is opened
				animationSpeed: 60,
				
				// don't close the tooltip on options.close
				disableCloseAfterDrag: true
			};

			var options = $.extend(true, defaults, opts); 
			
			options.data = options.content;
			options.content = '<span></span>';
			
			function trigger(ele, event){
//				console.log(ele);
//				console.log(event);
	        	var item = $(ele).data("item");
	        	
	        	if( item != null ){
	        		var fn = item[event];
	        		
	        		if( typeof fn == "function" ){
		        		fn(ele);
		        	}
	        	}
	        	
//	        		console.log(event);
	        }
			
//			console.log(options);

			
			var beforePaper = options.beforePaper;
			options.beforePaper = function(){
				function add_items(items, parent){
					var ul = $('<ul></ul>');
					$.each(items, function(i, item){
						var li = $('<li></li>');
						var a = $('<a href="#"><span class="ui-icon"></span> ' + item.name + '</a>');
						li.append(a);
						ul.append(li);
						
						if( item.newSection && i != 0 ){
							li.addClass("ui-menu-new-section");
						}
						
						if( item.items ){
							li.addClass("ui-menu-parent");
						}
						
						a.bind("click", function(){
							trigger(a, "select");
							
							a.removeClass("ui-state-hover");
							
							if( (item.items == null && item.menuClose == null && options.menuClose) || (item.items == null && item.menuClose) ){
								// destroy finished commands
								if( !(options.disableCloseAfterDrag && $("#" + id).hasClass("ui-tooltip-dragged") ) ){
									$("#" + id).qtip("api") && $("#" + id).qtip("api").forceHide();
								}
							} else if( li.children("ul").size() == 0 ){
								// go back to start
								var parent = li.parents("ul:last");
								parent.find("ul").hide();
								parent.find("a").show().removeClass("ui-menu-open");
								
								var position = li.parents("ul").size() + li.index() - 1;
								
								parent.children("li").fadeOut(options.animationSpeed, function(){
									parent.children("li").fadeIn(options.animationSpeed, function(){
										$("#" + id).qtip("api").reposition();
										
										parent.children("li").eq( position ).children("a").addClass("ui-state-hover");
									});
								});
							} else {
								
								if( li.find("ul:visible").size() > 0 ){
									// remove highlight on li
									li.children("a").removeClass("ui-state-hover");
									
									// add highlight to item that took its position
									li.parent().children(":first").children("a").addClass("ui-state-hover");
									
									// show children when clicking prev parent
									li.find("ul").hide("slide", { direction: "up" }, options.animationSpeed, function(){ 
										li.siblings("li").children("a").show();
										$("#" + id).qtip("api").reposition();
									});
									li.find("a").removeClass("ui-menu-open");
									
									if( item.newSection && i != 0 ){
										li.addClass("ui-menu-new-section");
									}
								} else {
									
									if( li.index() != 0 ){
										// remove highlight on li if it's not the first one
										li.children("a").removeClass("ui-state-hover");
										
										// add highlight to child that's under the mouse
										li.children("ul").children("li").eq( li.index() - 1 ).children("a").addClass("ui-state-hover");
									}
									
									// show children
									li.siblings().children("a").hide();
									li.children("ul").show("slide", { direction: "up" }, options.animationSpeed, function(){ 
										$("#" + id).qtip("api").reposition();
									}).find("a").show();
									li.children("a").addClass("ui-menu-open");
									
									if( item.newSection && i != 0 ){
										li.removeClass("ui-menu-new-section");
									}
								}
							}
		
							
							return false;
						}).bind("blur", function(){
							trigger(a, "blur");
						}).bind("focus", function(){
							trigger(a, "focus");
						});
						
						a.data("item", item);
						a.data("ul", ul);
						
						if( item.items != null ){
							add_items(item.items, li);
						}
					});
					
					if( parent != null ){
						parent.append(ul);
						ul.addClass("ui-tooltip-menu-command-sub-list");
					} else {
						ul.addClass("ui-tooltip-menu-command-list");
						if( options.data != null && options.data != "" ){
							$("#" + id + " .ui-tooltip-content").before(ul);
						} else {
							$("#" + id + " .ui-tooltip-content").append(ul);
						}
					}
					ul.menu();
				}
				add_items(options.items);
				
				if( options.data != null && options.data != "" ){
					var content = $('<div class="ui-tooltip-menu-command-content"><div class="ui-tooltip-menu-command-content-inner">' + options.data + '</div></div>');
					$("#" + id + " .ui-tooltip-content").append(content);
					$("#" + id).addClass("ui-tooltip-menu-command-with-content");
				}
				
				$("#" + id).addClass("ui-tooltip-menu-command");
				
				if( typeof beforePaper == "function" ){
					beforePaper();
				}
			};
			
			var ready = options.ready;
			options.ready = function(){
				var commands = $("#" + id + " .ui-tooltip-menu-command-list:first");
				
				var width = commands.width() + 1;
				commands.width( width );

				$("#" + id + " .ui-tooltip-menu-command-list:first").find("ul").hide();
				
				$("#" + id).qtip("api").reposition();
				
				if( typeof ready == "function" ){
					ready();
				}
				
			};
			
			$(this).commandtip(options);
			
			
		});
	}
	
})(jQuery);  