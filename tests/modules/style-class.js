$v(function(jQuery, $, version){
	
	defaultModule("$$.Style");
	
	test("constructor", function(){
		var style = new $$.Style(cy);

		ok( style.length > 0, "style is nonempty (default styles applied)" );
	});

	function deep(actual, expected, msg){
		if( !actual ){ ok(false, "actual is null :: " + msg); return; }

		for( var name in expected ){
			var expectedVal = expected[name];
			var actualVal = actual[name];

			deepEqual(actualVal, expectedVal, "for field " + name + " :: " + msg);
		}
	}

	test(".parse()", function(){
		var s = new $$.Style(cy);

		deep( s.parse("background-color", "red"), {
			name: "background-color",
			value: [255, 0, 0],
			strValue: "red"
		}, "parse a named colour" );

		deep( s.parse("borderColor", "rgb(12, 23, 34)"), {
			name: "border-color",
			strValue: "rgb(12, 23, 34)",
			value: [12, 23, 34],
		}, "parse a rgb colour with a camel case property name" );

		deep( s.parse("background-color", "rgba(12, 23, 34, 0.5)"), {
			name: "background-color",
			value: [12, 23, 34, 0.5],
			strValue: "rgba(12, 23, 34, 0.5)"
		}, "parse a rgba colour" );

		// TODO fix hsl colour parsing
		// deep( s.parse("background-color", "hsla(0, 50%, 50%, 0.75)"), {
		// 	name: "background-color",
		// 	value: [191, 64, 64, 0.75],
		// 	strValue: "hsla(0, 50%, 50%, 0.75)"
		// }, "parse a hsla colour" );

		deep( s.parse("height", "10px"), {
			name: "height",
			value: 10,
			strValue: "10px",
			units: "px",
			pxValue: 10
		}, "parse a height in px" );

		deep( s.parse("height", "10"), {
			name: "height",
			value: 10,
			strValue: "10px",
			units: "px",
			pxValue: 10
		}, "parse a height with implicit px" );

		deep( s.parse("height", 10), {
			name: "height",
			value: 10,
			strValue: "10px",
			units: "px",
			pxValue: 10
		}, "parse a numerical height with implicit px" );

		deep( s.parse("font-weight", "bold"), {
			name: "font-weight",
			value: "bold",
			strValue: "bold"
		}, "parse an enum (font-weight)" );

		deep( s.parse("content", "blah blah blah"), {
			name: "content",
			value: "blah blah blah",
			strValue: "blah blah blah"
		}, "parse an arbitrary string type (content)" );

		equal( s.parse("opacity", "-0.4"), null, "(negative) opacity outside valid range is null" );

		equal( s.parse("opacity", "1.001"), null, "(positive) opacity outside valid range is null" );

		deep( s.parse("font-family", "Arial, Times New Roman, Helvetica Neue"), {
			name: "font-family",
			value: ["Arial, Times New Roman, Helvetica Neue", "Arial, Times New Roman, Helvetica Neue"],
			strValue: "Arial, Times New Roman, Helvetica Neue"
		}, "parse a font family" );

		var data = s.parse("width", "data(weight)");
		deep( data, {
			name: "width",
			value: ["data(weight)", "weight"],
			strValue: "data(weight)",
			field: "weight"
		}, "parse width mapped to data(weight)" );
		ok( data.mapped, "data is mapped" );

		var mapData = s.parse("background-color", "mapData(weight, 0, 100, blue, red)");
		deep( mapData, {
			name: "background-color",
			value: ["mapData(weight, 0, 100, blue, red)", "weight", "0", "100", "blue", "red"],
			strValue: "mapData(weight, 0, 100, blue, red)",
			field: "weight",
			fieldMin: 0,
			fieldMax: 100,
			valueMin: [0, 0, 255],
			valueMax: [255, 0, 0]
		}, "parse with mapData to colour" );
		ok( mapData.mapped, "mapData is mapped" );
	});

	test(".selector() & .css()", function(){
		var s = new $$.Style(cy);
		s.clear();

		s.selector("node:selected");
		equal( s.length, 1, "one selector in the style" );
		equal( s[0].selector.toString(), "node:selected", "selector is as specified" );

		s.css("background-color", "red");
		equal( s[0].properties.length, 1, "property is added" );
		deep( s[0].properties[0], {
			name: "background-color", 
			value: [255, 0, 0],
			strValue: "red"
		}, "property is parsed properly");

		s.selector("edge");
		equal( s.length, 2, "two selectors in the style" );
		equal( s[1].selector.toString(), "edge", "selector is as specified" );

		s.css({
			width: 10,
			height: 10
		});
		s.css("z-index", 2);
		equal( s[1].properties.length, 3, "3 css properties" );
		equal( s[0].properties.length, 1, "1 css property in 1st selector (not modified by 2nd)" );
		
	});

	test(".applyParsedProperty()", function(){
		var ele = cy.$("#n1")[0]; // weight 0.25
		var style = new $$.Style(cy);
		var prop = style.parse("background-color", "red");
		var eleStyle = ele._private.style;

		// try a flat property
		style.applyParsedProperty( ele, prop );
		deep( ele._private.style["background-color"], prop, "rstyle is correct" );

		// try a mapData with colour
		prop = style.parse("background-color", "mapData(weight, 0, 0.5, black, red)");
		style.applyParsedProperty( ele, prop );
		deep( ele._private.style["background-color"], {
			value: [ 128, 0, 0, 1 ],
			name: "background-color",
			strValue: "rgba(128, 0, 0, 1)"
		}, "raw style is correct" );
		equal( ele._private.style["background-color"].mapping, prop, "mapped colour raw sytle has a reference to the original mapped property" );

		// try a mapData with number
		prop = style.parse("height", "mapData(weight, 0, 1, 0, 100)");
		style.applyParsedProperty( ele, prop );
		deep( ele._private.style["height"], {
			value: 25,
			name: "height",
			strValue: "25px",
			units: "px",
			pxValue: 25
		}, "raw style is correct" );
		equal( ele._private.style["height"].mapping, prop, "mapped height raw sytle has a reference to the original mapped property" );

		// try a data
		prop = style.parse("opacity", "data(weight)");
		style.applyParsedProperty( ele, prop );
		deep( ele._private.style["opacity"], {
			value: 0.25,
			name: "opacity",
			strValue: "0.25"
		}, "raw style is correct" );
		equal( ele._private.style["opacity"].mapping, prop, "mapped opacity raw sytle has a reference to the original mapped property" );

		// try a bypass
		prop = style.parse("background-color", "red");
		style.applyParsedProperty( ele, prop );
		var bypass = style.parse("background-color", "blue", true);
		style.applyParsedProperty( ele, bypass );
		equal( ele._private.style["background-color"], bypass, "bypass is applied over top" );
		equal( ele._private.style["background-color"].bypassed, prop, "bypass points to prop" );
		
		// apply a style with an existing bypass
		prop = style.parse("background-color", "yellow");
		style.applyParsedProperty( ele, prop );
		equal( ele._private.style["background-color"], bypass, "bypass isn't overwritten by new style" );
		equal( ele._private.style["background-color"].bypassed, prop, "bypass points to new prop" );

		// apply a new bypass over the old one
		bypass = style.parse("background-color", "orange", true);
		style.applyParsedProperty( ele, bypass );
		equal( eleStyle["background-color"], bypass, "new bypass is there" );
		equal( eleStyle["background-color"].bypassed, prop, "old prop is pointed to by new bypass" );

	});

	test(".apply() & .applyBypass()", function(){
		var ele = cy.$("#n1")[0]; // weight 0.25
		var style = new $$.Style(cy);
		var eleStyle = ele._private.style;

		// empty the style
		style
			.clear()
			.selector("node")
				.css({
					"background-color": "red",
					"height": "30",
					"width": "30"
				})
		;

		// apply the style to ele
		style.apply( ele );
		deepEqual( eleStyle["background-color"].value, [255, 0, 0], "bg colour ok" );
		deepEqual( eleStyle["height"].value, 30, "height ok" );
		deepEqual( eleStyle["width"].value, 30, "width ok" );

		// apply a bypass
		style.applyBypass( ele, "height", 33 );
		deepEqual( eleStyle["height"].value, 33 );

	});
	
});