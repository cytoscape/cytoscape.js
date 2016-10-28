## Details

The neighbourhood returned by this function is a bit different than the traditional definition of a "neighbourhood":  This returned neighbourhood includes the edges connecting the collection to the neighbourhood.  This gives you more flexibility.

An **open neighbourhood** is one that **does not** include the original set of elements.  If unspecified, a neighbourhood is open by default.

A **closed neighbourhood** is one that **does** include the original set of elements. 

## Examples

```js
cy.$('#j').neighborhood();
```