## Details

This function returns whether the `initrender` event has occurred on the graph, meaning that the renderer has drawn the graph at least once.  This is useful when you need to grab image data from the core, as this function will let you know whether that data is available yet:  You can not grab the graph scene if it has not yet been rendered.