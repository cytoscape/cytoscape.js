
/* jquery.cxtmenu.js */

/**
 * This file is part of cytoscape.js 2.0.4.
 * 
 * Cytoscape.js is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option) any
 * later version.
 * 
 * Cytoscape.js is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU Lesser General Public License along with
 * cytoscape.js. If not, see <http://www.gnu.org/licenses/>.
 */
 
;(function($){
	
	var defaults = {
		menuRadius: 100,
		cytoscape: true,
		selector: undefined,
		commands: [],
		fillColor: 'rgba(0, 0, 0, 0.75)',
		activeFillColor: 'rgba(92, 194, 237, 0.75)',
		activePadding: 20,
		indicatorSize: 30,
		indicatorColor: 'black',
		separatorWidth: 3,
		spotlightPadding: 4,
		itemColor: 'white',
		itemTextShadowColor: 'black'
	};
	
	$.fn.cxtmenu = function(params){
		var options = $.extend(true, {}, defaults, params);
		var fn = params;
		var $container = $(this);
		var cy;

		$container.cytoscape(function(e){
			cy = this;
		});
		
		var functions = {
			destroy: function(){
				
			},
				
			init: function(){
				var $parent = $('<div class="cxtmenu"></div>');
				var $canvas = $('<canvas></canvas>');
				var c2d = $canvas[0].getContext('2d');
				var r = options.menuRadius;
				var offset = $container.offset();
				var containerSize = (r + options.activePadding)*2;
				var activeCommandI = undefined;

				$container.append( $parent );
				$parent.append( $canvas );

				$parent.css({
					width: containerSize + 'px',
					height: containerSize + 'px',
					position: 'fixed',
					zIndex: 999999,
					marginLeft: offset.left - options.activePadding + 'px',
					marginTop: offset.top - options.activePadding + 'px'
				}).hide();

				$canvas[0].width = containerSize;
				$canvas[0].height = containerSize;

				var commands = options.commands;
				var dtheta = 2*Math.PI/(commands.length);
				var theta1 = commands.length % 2 !== 0 ? Math.PI/2 : 0;
				var theta2 = theta1 + dtheta;
				var $items = [];

				for( var i = 0; i < commands.length; i++ ){
					var command = commands[i];

					var midtheta = (theta1 + theta2)/2;
					var rx1 = 0.66 * r * Math.cos( midtheta );
					var ry1 = 0.66 * r * Math.sin( midtheta );

					// console.log(rx1, ry1, theta1, theta2)

					var $item = $('<div class="cxtmenu-item"></div>');
					$item.css({
						color: options.itemColor,
						cursor: 'default',
						display: 'table',
						'text-align': 'center',
						//background: 'red',
						position: 'absolute',
						'text-shadow': '-1px -1px ' + options.itemTextShadowColor + ', 1px -1px ' + options.itemTextShadowColor + ', -1px 1px ' + options.itemTextShadowColor + ', 1px 1px ' + options.itemTextShadowColor,
						left: '50%',
						top: '50%',
						'min-height': r * 0.66,
						width: r * 0.66,
						height: r * 0.66,
						marginLeft: rx1 - r * 0.33,
						marginTop: -ry1	-r * 0.33
					});
					
					var $content = $('<div class="cxtmenu-content">' + command.content + '</div>');
					$content.css({
						'width': r * 0.66,
						'height': r * 0.66,
						'vertical-align': 'middle',
						'display': 'table-cell'
					});
					
					$parent.append( $item );
					$item.append( $content );


					theta1 += dtheta;
					theta2 += dtheta;
				}

				function drawBg( rspotlight ){
					rspotlight = rspotlight !== undefined ? rspotlight : rs;

					c2d.globalCompositeOperation = 'source-over';

					c2d.clearRect(0, 0, containerSize, containerSize);

					c2d.fillStyle = options.fillColor;
					c2d.beginPath();
					c2d.arc(r + options.activePadding, r + options.activePadding, r, 0, Math.PI*2, true); 
					c2d.closePath();
					c2d.fill();

					c2d.globalCompositeOperation = 'destination-out';
					c2d.strokeStyle = 'white';
					c2d.lineWidth = options.separatorWidth;
					var commands = options.commands;
					var dtheta = 2*Math.PI/(commands.length);
					var theta1 = commands.length % 2 !== 0 ? Math.PI/2 : 0;
					var theta2 = theta1 + dtheta;

					for( var i = 0; i < commands.length; i++ ){
						var command = commands[i];

						var rx1 = r * Math.cos(theta1);
						var ry1 = r * Math.sin(theta1);
						c2d.beginPath();
						c2d.moveTo(r + options.activePadding, r + options.activePadding);
						c2d.lineTo(r + options.activePadding + rx1, r + options.activePadding - ry1);
						c2d.closePath();
						c2d.stroke();

						// var rx2 = r * Math.cos(theta2);
						// var ry2 = r * Math.sin(theta2);
						// c2d.moveTo(r, r);
						// c2d.lineTo(r + rx2, r + ry2);
						// c2d.stroke();

						theta1 += dtheta;
						theta2 += dtheta;
					}
					

					c2d.fillStyle = 'white';
					c2d.globalCompositeOperation = 'destination-out';
					c2d.beginPath();
					c2d.arc(r + options.activePadding, r + options.activePadding, rspotlight + options.spotlightPadding, 0, Math.PI*2, true); 
					c2d.closePath();
					c2d.fill();

					c2d.globalCompositeOperation = 'source-over';
				}
				
				var lastCallTime = 0;
				var minCallDelta = 1000/30;
				var endCallTimeout;
				var firstCall = true;
				function rateLimitedCall( fn ){
					var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
					var now = +new Date;

					clearTimeout( endCallTimeout );

					if( firstCall || now >= lastCallTime + minCallDelta ){
						requestAnimationFrame(fn);
						lastCallTime = now;
						firstCall = false;
					} else {
						endCallTimeout = setTimeout(function(){
							requestAnimationFrame(fn);
							lastCallTime = now;
						}, minCallDelta * 2);
					}
				}

				var ctrx, ctry, rs;
				var tapendHandler;

				cy
					.on('cxttapstart', options.selector, function(e){
						var ele = this;
						var rp = ele.renderedPosition();
						var rw = ele.renderedWidth();
						var rh = ele.renderedHeight();
						var scrollLeft = $(window).scrollLeft();
						var scrollTop = $(window).scrollTop();

						ctrx = rp.x;
						ctry = rp.y;

						$parent.show().css({
							'left': rp.x - r - scrollLeft,
							'top': rp.y - r - scrollTop
						});

						rs = Math.max(rw, rh);
						rs = 32;

						drawBg();

						activeCommandI = undefined;
					})

					.on('cxtdrag', options.selector, function(e){ rateLimitedCall(function(){

						var dx = e.originalEvent.pageX - $container.offset().left - ctrx;
						var dy = e.originalEvent.pageY - $container.offset().top - ctry;

						if( dx === 0 ){ dx = 0.01; }

						var d = Math.sqrt( dx*dx + dy*dy );
						var cosTheta = (dy*dy - d*d - dx*dx)/(-2 * d * dx);
						var theta = Math.acos( cosTheta );

						activeCommandI = undefined;

						if( d < rs + options.spotlightPadding ){
							drawBg();
							return;
						}

						drawBg();

						var rx = dx*r / d;
						var ry = dy*r / d;
						
						if( dy > 0 ){
							theta = Math.PI + Math.abs(theta - Math.PI);
						}

						var commands = options.commands;
						var dtheta = 2*Math.PI/(commands.length);
						var theta1 = commands.length % 2 !== 0 ? Math.PI/2 : 0;
						var theta2 = theta1 + dtheta;

						for( var i = 0; i < commands.length; i++ ){
							var command = commands[i];


							// console.log(i, theta1, theta, theta2);

							var inThisCommand = theta1 <= theta && theta <= theta2
								|| theta1 <= theta + 2*Math.PI && theta + 2*Math.PI <= theta2;

							if( inThisCommand ){
								// console.log('in command ' + i)
								
								c2d.fillStyle = options.activeFillColor;
								c2d.strokeStyle = 'black';
								c2d.lineWidth = 1;
								c2d.beginPath();
								c2d.moveTo(r + options.activePadding, r + options.activePadding);
								c2d.arc(r + options.activePadding, r + options.activePadding, r + options.activePadding, 2*Math.PI - theta1, 2*Math.PI - theta2, true);
								c2d.closePath();
								c2d.fill();
								//c2d.stroke();

								activeCommandI = i;

								break;
							}

							theta1 += dtheta;
							theta2 += dtheta;
						}

						c2d.fillStyle = 'white';
						c2d.globalCompositeOperation = 'destination-out';

						// clear the indicator
						c2d.beginPath();
						//c2d.arc(r + rx/r*(rs + options.spotlightPadding), r + ry/r*(rs + options.spotlightPadding), options.indicatorSize, 0, 2*Math.PI, true);
					
						c2d.translate( r + options.activePadding + rx/r*(rs + options.spotlightPadding - options.indicatorSize/4), r + options.activePadding + ry/r*(rs + options.spotlightPadding - options.indicatorSize/4) );
						c2d.rotate( Math.PI/4 - theta );
						c2d.fillRect(-options.indicatorSize/2, -options.indicatorSize/2, options.indicatorSize, options.indicatorSize);
						c2d.closePath();
						c2d.fill();

						c2d.setTransform(1, 0, 0, 1, 0, 0);

						// clear the spotlight
						c2d.beginPath();
						c2d.arc(r + options.activePadding, r + options.activePadding, rs + options.spotlightPadding, 0, Math.PI*2, true); 
						c2d.closePath();
						c2d.fill();

						c2d.globalCompositeOperation = 'source-over';
					}) })

					.on('cxttapend', options.selector, function(e){
						var ele = this;
						$parent.hide();

						if( activeCommandI !== undefined ){
							var select = options.commands[ activeCommandI ].select;

							if( select ){
								select.apply( ele );
							}
						}
					})

					.on('cxttapend', function(e){
						$parent.hide();
					})
				;
			}
		};
		
		if( functions[fn] ){
			return functions[fn].apply(this, Array.prototype.slice.call( arguments, 1 ));
		} else if( typeof fn == 'object' || !fn ) {
			return functions.init.apply( this, arguments );
		} else {
			$.error("No such function `"+ fn +"` for jquery.cxtmenu");
		}
		
		return $(this);
	};
	
})(jQuery);