## Notes & caveats

A selector functions similar to a CSS selector on DOM elements, but selectors in Cytoscape.js instead work on collections of graph elements.  Note that wherever a selector may be specified as the argument to a function, a [`eles.filter()`](#collection/building--filtering/eles.filter)-style filter function may be used in place of the selector.  For example:

```js
cy.$('#j').neighborhood(function( ele ){
  return ele.isEdge();
});
```

The selectors can be combined together to make powerful queries in Cytoscape.js, for example:

```js
// get all nodes with weight more than 50 and height strictly less than 180
cy.elements("node[weight >= 50][height < 180]");
```

Selectors can be joined together (effectively creating a logical OR) with commas:

```js
// get node j and the edges coming out from it
cy.elements('node#j, edge[source = "j"]');
```

It is important to note that strings need to be enclosed by quotation marks:

```js
//cy.filter('node[name = Jerry]'); // this doesn't work
cy.filter('node[name = "Jerry"]'); // but this does
```

Note that metacharacters ( ^ $ \ / ( ) | ? + * [ ] { } , . ) need to be escaped:

```js
cy.filter('#some\\$funky\\@id');
```



## Group, class, & ID

**`node`,  `edge`, or `*` (group selector)**
Matches elements based on group (`node` for nodes, `edge` for edges, `*` for all).

**`.className`**
Matches elements that have the specified class (e.g. use `.foo` for a class named "foo").

**`#id`**
Matches element with the matching ID (e.g. `#foo` is the same as `[id = 'foo']`)


## Data

**`[name]`**  
Matches elements if they have the specified data attribute defined, i.e. not `undefined` (e.g. `[foo]` for an attribute named "foo").  Here, `null` is considered a defined value.

**`[^name]`**  
Matches elements if the specified data attribute is not defined, i.e. `undefined` (e.g `[^foo]`).  Here, `null` is considered a defined value.

**`[?name]`**  
Matches elements if the specified data attribute is a [truthy](http://javascriptweblog.wordpress.com/2011/02/07/truth-equality-and-javascript/) value (e.g. `[?foo]`).

**`[!name]`**  
Matches elements if the specified data attribute is a [falsey](http://javascriptweblog.wordpress.com/2011/02/07/truth-equality-and-javascript/) value (e.g. `[!foo]`).

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

**`!` (data attribute operator modifier)**  
Prepended to an operator so that it is negated (e.g. `[foo !$= 'ar']`, `[foo !>= 'a']`)

**`[[]]` (metadata brackets)**  
Use double square brackets in place of square ones to match against metadata instead of data (e.g. `[[degree > 2]]` matches elements of degree greater than 2).  The properties that are supported include `degree`, `indegree`, and `outdegree`.

## Edges

**`->` (directed edge selector)**
Matches edges for which the source and target subselectors match (e.g. `.src -> .tgt`)

**`<->` (undirected edge selector)**
Matches edges for which the connected node subselectors match (e.g. `.foo <-> .bar`)

## Compound nodes

**`>` (child selector)**  
Matches direct children of the parent node (e.g. `node > node`).

**<code>&nbsp;</code> (descendant selector)**  
Matches descendants of the parent node (e.g. `node node`).

**`$` (subject selector)**  
Sets the subject of the selector (e.g. `$node > node` to select the parent nodes instead of the children).  A subject selector may not be used with an edge selector, because the edge ought to be the subject.


## State

**Animation**

* **`:animated`** : Matches elements that are currently being animated.
* **`:unanimated`** : Matches elements that are not currently being animated.


**Selection**

* **`:selected`** : Matches selected elements.
* **`:unselected`** : Matches elements that aren't selected.
* **`:selectable`** : Matches elements that are selectable.
* **`:unselectable`** : Matches elements that aren't selectable.


**Locking**

* **`:locked`** : Matches locked elements.
* **`:unlocked`** : Matches elements that aren't locked.


**Style**

* **`:visible`** : Matches elements that are visible (i.e. `display: element` and `visibility: visible`).
* **`:hidden`** : Matches elements that are hidden (i.e. `display: none` or `visibility: hidden`).
* **`:transparent`** : Matches elements that are transparent (i.e. `opacity: 0` for self or parents).
* **`:backgrounding`** : Matches an element if its background image is currently loading.
* **`:nonbackgrounding`** : Matches an element if its background image not currently loading; i.e. there is no image or the image is already loaded).


**User interaction:**

 * **`:grabbed`** :  Matches elements that are being grabbed by the user.
 * **`:free`** :  Matches elements that are not currently being grabbed by the user.
 * **`:grabbable`** :  Matches elements that are grabbable by the user.
 * **`:ungrabbable`** :  Matches elements that are not grabbable by the user.
 * **`:active`** :  Matches elements that are active (i.e. user interaction, similar to `:active` in CSS).
 * **`:inactive`** : Matches elements that are inactive (i.e. no user interaction).
 * **`:touch`** : Matches elements when displayed in a touch-based enviroment (e.g. on a tablet).

**In or out of graph**

* **`:removed`** : Matches elements that have been removed from the graph.
* **`:inside`** : Matches elements that have are in the graph (they are not removed).


**Compound nodes**

* **`:parent`** : Matches parent nodes (they have one or more child nodes).
* **`:childless`** : Matches childless nodes (they have zero child nodes).
* **`:child`** or **`:nonorphan`**: Matches child nodes (they each have a parent).
* **`:orphan`** : Matches orphan nodes (they each have no parent).

**Edges**

* **`:loop`** : Matches loop edges (same source as target).
* **`:simple`** : Matches simple edges (i.e. as would be in a *simple* graph, different source as target).
