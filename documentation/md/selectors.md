## Notes & caveats

A selector functions similar to a [jQuery selector](http://api.jquery.com/category/selectors/) on DOM elements, but selectors in Cytoscape.js instead work on collections.

The selectors can be combined together to make powerful queries in Cytoscape.js, for example:

```js
// get all nodes with weight greater than or equal to 30
cy.elements("node[weight >= 50][height < 180]"); 
```

Selectors can be joined together (effectively creating a logical OR) with commas:

```js
// get node j and the edges coming out from it
cy.elements("node#j, edge[source = 'j']");
```

It is important to note that strings need to be enclosed by quotation marks:

```js
//cy.filter("node[name = Jerry]"); // this doesn't work
cy.filter("node[name = 'Jerry']"); // but this does
``` 



## Group & class

**`node` or `edge` (group selector)**  
Matches elements based on group (`node` for nodes, `edge` for edges).

**`.className`**  
Matches elements that have the specified class (e.g. use `.foo` for a class named "foo").


## Data

**`[name]`**  
Matches elements if they have the specified data attribute defined aka not `undefined` (e.g. `[foo]` for an attribute named "foo").  Here, `null` is considered a defined value.

**`[?name]`**  
Matches elements if the specified data attribute is a [truthy](http://javascriptweblog.wordpress.com/2011/02/07/truth-equality-and-javascript/) value (e.g. `[?foo]`).

**`[!name]`**  
Matches elements if the specified data attribute is a [falsey](http://javascriptweblog.wordpress.com/2011/02/07/truth-equality-and-javascript/) value (e.g. `[!foo]`).

**`[^name]`**  
Matches elements if the specified data attribute is not defined aka `undefined` (e.g `[^foo]`).  Here, `null` is considered a defined value.

**`[name = value]`**  
Matches elements if their data attribute matches a specified value (e.g. `[foo = 'bar']` or `[num = 2]`).

**`[name != value]`**  
Matches elements if their data attribute doesn't match a specified value (e.g. `[foo != 'bar']` or `[num != 2]`).

**`[name > value]`**  
Matches elements if their data attribute is greater than a specified value (e.g. `[foo > 'bar']` or `[num > 2]`).

**`[name >= value]`**  
Matches elements if their data attribute is greater than or equal to a specified value (e.g. `[foo >= 'bar']` or `[num >= 2]`).

**`[name < value]`**  
Matches elements if their data attribute is less than a specified value (e.g. `[foo < 'bar']` or `[num < 2]`).

**`[name <= value]`**  
Matches elements if their data attribute is less than or equal to a specified value (e.g. `[foo <= 'bar']` or `[num <= 2]`).

**`[name *= value]`**  
Matches elements if their data attribute contains the specified value as a substring (e.g. `[foo *= 'bar']`).

**`[name ^= value]`**  
Matches elements if their data attribute starts with the specified value (e.g. `[foo ^= 'bar']`).

**`[name $= value]`**  
Matches elements if their data attribute ends with the specified value (e.g. `[foo $= 'bar']`).

**`@` (data attribute operator modifier)**  
Prepended to an operator so that is case insensitive (e.g. `[foo @$= 'ar']`, `[foo @>= 'a']`, `[foo @= 'bar']`)

**`{}` (metadata brackets)**  
Use curly brackets in place of square ones to match against metadata instead of data (e.g. `{degree > 2}` matches elements of degree greater than 2).  The properties that are supported include `degree`, `indegree`, and `outdegree`.


## Compound nodes

**`>` (child selector)**  
Matches direct children of the parent node (e.g. `node > node`).

**<code>&nbsp;</code> (descendant selector)**  
Matches descendants of the parent node (e.g. `node node`).

**`$` (subject selector)**  
Sets the subject of the selector (e.g. `$node > node` to select the parent nodes instead of the children).


## State

**`:animated`**  
Matches elements that are currently being animated.

**`:unanimated`**  
Matches elements that are not currently being animated.

**`:selected`**  
Matches selected elements.

**`:unselected`**  
Matches elements that aren't selected.

**`:selectable`**  
Matches elements that are selectable.

**`:unselectable`**  
Matches elements that aren't selectable.

**`:locked`**  
Matches locked elements.

**`:unlocked`**  
Matches elements that aren't locked.

**`:visible`**  
Matches elements that are visible.

**`:hidden`**  
Matches elements that are hidden.

**`:grabbed`**  
Matches elements that are being grabbed by the user.

**`:free`**  
Matches elements that are not currently being grabbed by the user.

**`:grabbable`**  
Matches elements that are grabbable by the user.

**`:ungrabbable`**  
Matches elements that are not grabbable by the user.

**`:removed`**  
Matches elements that have been removed from the graph.

**`:inside`**  
Matches elements that have are in the graph (they are not removed).

**`:active`**  
Matches elements that are active (i.e. user interaction).

**`:inactive`**  
Matches elements that are inactive (i.e. no user interaction).