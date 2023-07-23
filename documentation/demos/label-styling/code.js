window.addEventListener('DOMContentLoaded', function () { // on dom ready

    // photos from flickr with creative commons license

    var cy = cytoscape({
        container: document.getElementById('cy'),

        style: cytoscape.stylesheet()
            .selector('node')
            .style({
                'content': 'data(id)',
                'height': 80,
                'width': 80,
                'background-fit': 'cover',
                'border-color': '#000',
                'border-width': 3,
                'border-opacity': 0.5,
                "text-background-opacity": 1,
                "text-background-color": "#e5e5e5",
                // 'text-background-shape': 'rectangle',
                'text-background-padding': '2px',
                "text-border-opacity": 1,
                'text-border-width': 1,
                'text-border-color': '#fdd7d7',
                'text-border-radius': '50px',
            })
            .selector('.eating')
            .style({
                'border-color': 'red'
            })
            .selector('.eater')
            .style({
                'border-width': 9
            })
            .selector('edge')
            .style({
                'width': 6,
                'target-arrow-shape': 'triangle',
                'line-color': '#ffaaaa',
                'target-arrow-color': '#ffaaaa',
                'curve-style': 'bezier',
                'content': 'data(label)',
                'font-size': 20,
                "text-background-opacity": 1,
                "text-background-color": "yellow",
                'text-background-padding': '20px',
                "text-border-opacity": 1,
                'text-border-width': 1,
                'text-border-color': '#fdd7d7',
                'text-border-radius': '20px',
                'color': '#000000',
                'text-border-style': 'dashed',
            })
            .selector('#bird')
            .style({
                'background-image': 'https://live.staticflickr.com/7272/7633179468_3e19e45a0c_b.jpg'
            })
            .selector('#cat')
            .style({
                'background-image': 'https://live.staticflickr.com/1261/1413379559_412a540d29_b.jpg'
            })
            .selector('#ladybug')
            .style({
                'background-image': 'https://live.staticflickr.com/3063/2751740612_af11fb090b_b.jpg'
            })
            .selector('#aphid')
            .style({
                'background-image': 'https://live.staticflickr.com/8316/8003798443_32d01257c8_b.jpg'
            })
            .selector('#rose')
            .style({
                'background-image': 'https://live.staticflickr.com/5109/5817854163_eaccd688f5_b.jpg'
            })
            .selector('#grasshopper')
            .style({
                'background-image': 'https://live.staticflickr.com/6098/6224655456_f4c3c98589_b.jpg'
            })
            .selector('#plant')
            .style({
                'background-image': 'https://live.staticflickr.com/7849/47488157892_3d9ebcdec6_c.jpg'
            })
            .selector('#wheat')
            .style({
                'background-image': 'https://live.staticflickr.com/2660/3715569167_7e978e8319_b.jpg',
                'shape': 'star'
            }),

        elements: {
            nodes: [
                { data: { id: 'cat' } },
                { data: { id: 'bird' } },
                { data: { id: 'ladybug' } },
                { data: { id: 'aphid' } },
                { data: { id: 'rose' } },
                { data: { id: 'grasshopper' } },
                { data: { id: 'plant' } },
                { data: { id: 'wheat' } }
            ],
            edges: [
                { data: { source: 'cat', target: 'bird', label: "Cat -> bird" } },
                { data: { source: 'bird', target: 'ladybug', label: "bird -> ladybug" } },
                { data: { source: 'bird', target: 'grasshopper' } },
                { data: { source: 'grasshopper', target: 'plant', label: "grasshopper -> plant" } },
                { data: { source: 'grasshopper', target: 'wheat' } },
                { data: { source: 'ladybug', target: 'aphid' } },
                { data: { source: 'aphid', target: 'rose' } }
            ]
        },

        layout: {
            name: 'breadthfirst',
            directed: true
        }
    }); // cy init


}); // on dom ready