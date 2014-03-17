// set up SVG for D3
var width  = 1260,
    height = 800,
    colors = d3.scale.category10();

var svg = d3.select('body')
  .append('svg')
  .attr('width', width)
  .attr('height', height);

// set up initial nodes and links
//  - nodes are known by 'id', not by index in array.
//  - reflexive edges are indicated on the node (as a bold black circle).
//  - links are always source < target; edge directions are set by 'left' and 'right'.
var nodes = [
    
  ],
  lastNodeId = 2,
  links = [
  ];


var fetchUserD3 = null;
var lastSelected = null;
var populateD3 = function() {

    var userIdMap = {};
    var userFetchedMap = {};
    var userFetchRequest = {};
    var userIdCtr=0;


    var addUserNode = function(userName, label,  followers, pic) {
      var objNode = userIdMap[userName];
      if(objNode) {
        return objNode;
      }
      var obj = { id:userIdCtr++, reflexive:true, name:userName, label:label, followers:followers , resourcePictureURL: pic} ;
      userIdMap [ userName ] = obj;
      nodes.push(obj);
      return obj;
    }
    var fetchUserClicked = true;
    var _neoServer = "192.168.1.12:7474";
    //var _neoServer = "localhost:7474";

    var fetchUser = function(userName, label, onlyAddEdgeToExistingNodes) {
        if(userFetchedMap[userName] || userFetchRequest[userName]) {
          return;
        }
        userFetchRequest[userName] = new Date();
        var http = new XMLHttpRequest();

        var url = "http://" + _neoServer + "/db/data/cypher";
        var data = JSON.stringify( {"query": 
        "START a = node:`node_auto_index`('type:myexperiments.org\\\\/user AND uri:" + userName.replace(':', '\\\\:').replace('/', '\\\\/') +"')\r\n\
        MATCH \r\n\
        p= a-[:`myfriend`]->c \r\n\
                \r\n\
        RETURN a.uri, a.name, c.uri, c.name, c.valueString, count(p), c.resourcePictureURL" })  ;
        http.open("POST", url, true);

        //Send the proper header information along with the request
        http.setRequestHeader("Content-type", "application/json");
        http.setRequestHeader("Content-length", data.length);
        http.setRequestHeader("Connection", "close");

        http.onreadystatechange = function() {//Call a function when the state changes.
          if(http.readyState == 4 && http.status == 200) {
             console.log(http);
             var result = JSON.parse(http.responseText);
             var sourceNode = addUserNode(userName , label? label:userName , 40/*todo: pass followers count rather */);
             userFetchedMap[userName] = sourceNode.id;
            console.log('Link for ' + userName);

               for(var i=0;i<result.data.length; i++) {

                  {
                  var follow = addUserNode(result.data[i][2], result.data[i][3], result.data[i][5], result.data[i][6]);
                  
                  links.push( {source: sourceNode , target: follow, left: false, right: true });
                    //if( fetchUserClicked ) {
               
                   /*  ( function(thisUser) {
                                window.setTimeout( function () { fetchUser( thisUser, thisUser, true ); 
                              } , 50);
                            })(result.data[i][2]);*/  
                     } 
                  //} 
                }
                
                fetchUserClicked = false;
                selected_link = null;
                selected_node = null;
                restart();
          }
         }
        http.send(data);


    };

    //expose fetchUser as fetchUserD3
    fetchUserD3 = fetchUser;

    // init D3 force layout
    var force = d3.layout.force()
        .nodes(nodes)
        .links(links)
        .size([width, height])
        //.gravity(0.8)
        //.linkDistance(300)
        .linkDistance( function(lnk) {
          return 400 / (lnk.target.followers + 1);
          /*
          if(lnk.target.followers < 10 ) {
            return 200 - lnk.target.followers *3;
          }
          else
              return  (500/lnk.target.followers )+ 300 ;  // todo degree of closeness should be based on how many are common between 
          */
        }) 
        //.charge(-310)
        .charge( function( n) { 
          window.console.log('followers: ' + n.followers)
          if(n.followers > 1) {
            n.fixed = true;
          }
          return -1000*n.followers;
          /*
            if(n.followers < 10 ) {
              return  -113*n.followers;
            }
            else
              return 10*Math.log(n.followers) ; 
            */
        })
        .on('tick', tick);

    // define arrow markers for graph links
    var svgDef = svg.append('svg:defs');

    /*
    <clipPath id="eyeLeftPath">
        <circle cx="50" cy="50" r="50" />
        </clipPath>
        */
    svgDef.append('svg:clipPath')
        .attr('id','circ')
        .append('svg:circle')
        .attr('cx','0')
        .attr('cy','0')
        .attr('r','20');
      /*  <path id="text_0_path" d="M 100 150 A 100 100 0 1 1 300 150"/> */
      svgDef.append('path').attr('id', 'text_to_path').attr('d', 'M  00 10 A 50 50 0 1 1 100 150');
    
    svgDef.append('svg:marker')
        .attr('id', 'end-arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 6)
        .attr('markerWidth', 3)
        .attr('markerHeight', 3)
        .attr('orient', 'auto')
      .append('svg:path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#000');

    svg.append('svg:defs').append('svg:marker')
        .attr('id', 'start-arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 4)
        .attr('markerWidth', 3)
        .attr('markerHeight', 3)
        .attr('orient', 'auto')
      .append('svg:path')
        .attr('d', 'M10,-5L0,0L10,5')
        .attr('fill', '#000');

    // line displayed when dragging new nodes
    var drag_line = svg.append('svg:path')
      .attr('class', 'link dragline hidden')
      .attr('d', 'M0,0L0,0');

    // handles to link and node element groups
    var path = svg.append('svg:g').selectAll('path'),
        circle = svg.append('svg:g').selectAll('g');

    // mouse event vars
    var selected_node = null,
        selected_link = null,
        mousedown_link = null,
        mousedown_node = null,
        mouseup_node = null;

    function resetMouseVars() {
      mousedown_node = null;
      mouseup_node = null;
      mousedown_link = null;
    }


    var getWeightScale = function(d, e,scaleMore){
          scaleMore = scaleMore||1;
            if(d.followers < 3 ) {
              return 'translate(' + d.x + ',' + d.y + '),' + 'scale('+(1*scaleMore) + ',' +1*scaleMore+')';
            }
            else {
              return 'translate(' + d.x + ',' + d.y + '),' + 'scale(' + Math.log((d.followers*scaleMore)/2) + ',' +Math.log((d.followers*scaleMore)/2) +')';
          }

        };
    var tickStop = false;
    // update force layout (called automatically each iteration)
    function tick() {
      // draw directed edges with proper padding from node centers
      if(tickStop ) {
        
        return;
      }
      path.attr('d', function(d) {
        var deltaX = d.target.x - d.source.x,
            deltaY = d.target.y - d.source.y,
            dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
            normX = deltaX / dist,
            normY = deltaY / dist,
            sourcePadding = d.left ? 17 : 12,
            targetPadding = d.right ? 17 : 12,
            sourceX = d.source.x + (sourcePadding * normX),
            sourceY = d.source.y + (sourcePadding * normY),
            targetX = d.target.x - (targetPadding * normX),
            targetY = d.target.y - (targetPadding * normY);
        return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
      });

      circle.attr('transform', getWeightScale) ; /* function(d) {
        return 'translate(' + d.x + ',' + d.y + ')';
      });*/
    }

    // update graph (called when needed)
    function restart() {
      // path (link) group
      path = path.data(links);

      // update existing links
      path.classed('selected', function(d) { return d === selected_link; })
        .style('marker-start', function(d) { return d.left ? 'url(#start-arrow)' : ''; })
        .style('marker-end', function(d) { return d.right ? 'url(#end-arrow)' : ''; });


      // add new links
      path.enter().append('svg:path')
        .attr('class', 'link')
        .style('stroke', function(d) { return d3.rgb(colors(d.source.id)).darker().toString(); })
        .style('stroke-opacity', 0.3)
        .classed('selected', function(d) { return d === selected_link; })
        .style('marker-start', function(d) { return d.left ? 'url(#start-arrow)' : ''; })
        .style('marker-end', function(d) { return d.right ? 'url(#end-arrow)' : ''; })
        .on('mousedown', function(d) {
          if(d3.event.ctrlKey) return;

          if(lastSelected) {
            lastSelected.selected = false;
          }
          lastSelected = d;
          lastSelected.selected = true;
          // select link
          mousedown_link = d;
          if(mousedown_link === selected_link) selected_link = null;
          else selected_link = mousedown_link;
          selected_node = null;
          restart();
        });

      // remove old links
      path.exit().remove();


      // circle (node) group
      // NB: the function arg is crucial here! nodes are known by id, not by index!
      circle = circle.data(nodes, function(d) { return d.id; });

      // update existing nodes (reflexive & selected visual states)
      circle.selectAll('.node')
        .style('fill', function(d) { return (d === selected_node) ? d3.rgb(colors(d.id)).brighter().toString() : colors(d.id); })
        .classed('reflexive', function(d) { return d.reflexive; });
        
      // add new nodes
      var g = circle.enter().append('svg:g')  .call(force.drag) ;
      /*
      <g transform="translate(130,50)">
            <image clip-path="url(#eyeLeftPath)" xlink:href="./Images/Syed2.png" x="0" y="0" height="100" width="100"></image>
        </g> */
/*
      g.on('mouseenter', function (d,e) {

          d3.select(this).attr('transform', getWeightScale(d,e,4));

      });

      g.on('mouseout', function (d,e) {

          d3.select(this).attr('transform', getWeightScale(d,e));

      });         
  */
       g.append('svg:image').attr('clip-path','url(#circ)').attr('xlink:href',
          function(d) { return d.resourcePictureURL ; //* "./Directed Graph Editor_files/JPEG/pic-" + d.name + ".jpg";*/
           } )
      .attr('x','-20')
      .attr('y','-20')
      .attr('height',40)
      .attr('width',40);
     
       svg.on('dblclick', function () {
        if(!tickStop) { 
          tickStop = true;
          force.stop();
        } else {
          tickStop = false;
          force.resume();
          force.tick();
        }

       });
      circle.attr('opacity', 0.8);
      circle.attr('transform', getWeightScale);

      var tip = d3.select(".tip");
      circle.on('mousedown', function(d) {
          if(d3.event.ctrlKey) return;
          d.fixed = true;
          d3.event.stopPropagation();
          tickStop = false;
          svg.select('.tip').remove();

          tip.select(".row.uri .val").text(d.name);
          tip.select(".row.name .val").text(d.label);
          //tip.select(".row.uri .propval").text(d.label);
          //tip.select(".row.name .prop").text(d.label);
           
        }).on('dblclick', function (d) {
            d.fixed = false;
        });
 

      g.append('svg:circle')
        .attr('class', 'node')
        .attr('r',20)
        .attr('rx', 20)
        .attr('ry',20)
        .style('fill', function(d) { return (d === selected_node) ? d3.rgb(colors(d.id)).brighter().toString() : colors(d.id); })
        .style('stroke', function(d) { return d3.rgb(colors(d.id)).darker().toString(); })
        .classed('reflexive', function(d) { return d.reflexive; })
        .on('mouseover', function(d) {
          // enlarge target node
        })
        .on('mouseout', function(d) {
          if(!mousedown_node || d === mousedown_node) return;
          // unenlarge target node
          d3.select(this).attr('transform', '');
        })
        .on('mousedown', function(d) {
          if(d3.event.ctrlKey) return;
        })
        .on('mouseup', function(d) {
        });

      // show node IDs
        g.append('svg:text')
          .attr('x', 0)
          .attr('y', 19)
          .attr('class', 'id')
          .text(function(d) { return d.label; })
           
          
/*
<textPath xlink:href="#text_0_path" startOffset="50%">
            <!-- 157.075 is the center of the length of an arc of radius 100 -->
            <tspan x="157.075">Here is a line</tspan>
            */
            /* <use xlink:href="#text_0_path" stroke="blue" fill="none"/> */
           // g.append('svg:use').attr('xlink:href', '#test_to_path').attr('stroke','blue').attr('fill','none');
    

      // remove old nodes
      circle.exit().remove();

      // set the graph in motion
      force.start();
    }

    function mousedown() {
      // prevent I-bar on drag
      //d3.event.preventDefault();
      
      // because :active only works in WebKit?
/*      svg.classed('active', true);

      if(d3.event.ctrlKey || mousedown_node || mousedown_link) return;

      // insert new node at point
      var point = d3.mouse(this),
          node = {id: ++lastNodeId, reflexive: false};
      node.x = point[0];
      node.y = point[1];
      nodes.push(node);

      restart(); */
    }

    function mousemove() {
/*      if(!mousedown_node) return;

      // update drag line
      drag_line.attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + d3.mouse(this)[0] + ',' + d3.mouse(this)[1]);

      restart(); */
    }

    function mouseup() {
/*      if(mousedown_node) {
        // hide drag line
        drag_line
          .classed('hidden', true)
          .style('marker-end', '');
      }

      // because :active only works in WebKit?
      svg.classed('active', false);

      // clear mouse event vars
      resetMouseVars(); 
      */
    }

    function spliceLinksForNode(node) {
      var toSplice = links.filter(function(l) {
        return (l.source === node || l.target === node);
      });
      toSplice.map(function(l) {
        links.splice(links.indexOf(l), 1);
      });
    }

    // only respond once per keydown
    var lastKeyDown = -1;

    function keydown() {
      d3.event.preventDefault();

      if(lastKeyDown !== -1) return;
      lastKeyDown = d3.event.keyCode;

      // ctrl
      if(d3.event.keyCode === 17) {
        circle.call(force.drag);
        svg.classed('ctrl', true);
      }

      if(!selected_node && !selected_link) return;
      switch(d3.event.keyCode) {
        case 8: // backspace
        case 46: // delete
          if(selected_node) {
            nodes.splice(nodes.indexOf(selected_node), 1);
            spliceLinksForNode(selected_node);
          } else if(selected_link) {
            links.splice(links.indexOf(selected_link), 1);
          }
          selected_link = null;
          selected_node = null;
          restart();
          break;
        case 66: // B
          if(selected_link) {
            // set link direction to both left and right
            selected_link.left = true;
            selected_link.right = true;
          }
          restart();
          break;
        case 76: // L
          if(selected_link) {
            // set link direction to left only
            selected_link.left = true;
            selected_link.right = false;
          }
          restart();
          break;
        case 82: // R
          if(selected_node) {
            // toggle node reflexivity
            selected_node.reflexive = !selected_node.reflexive;
          } else if(selected_link) {
            // set link direction to right only
            selected_link.left = false;
            selected_link.right = true;
          }
          restart();
          break;
      }
    }

    function keyup() {
      lastKeyDown = -1;

      // ctrl
      if(d3.event.keyCode === 17) {
        circle
          .on('mousedown.drag', null)
          .on('touchstart.drag', null);
        svg.classed('ctrl', false);
      }
    }

    // app starts here
    svg.on('mousedown', mousedown)
      .on('mousemove', mousemove)
      .on('mouseup', mouseup);
    d3.select(window)
      .on('keydown', keydown)
      .on('keyup', keyup);
    restart();

    fetchUser('http://www.myexperiment.org/user.xml?id=9', 'Jun Zhao'); //start with a user
} //end populateD3

populateD3();