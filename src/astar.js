var assert = require('assert')
  , Heap = require('heap')

export default async function aStar({ start, isEnd, neighbor, distance, heuristic, timeout = Infinity, hash = defaultHash } = {}) {
  assert.ok(start !== undefined);
  assert.ok(isEnd !== undefined);
  assert.ok(neighbor);
  assert.ok(distance);
  assert.ok(heuristic);
  assert.ok(!isNaN(timeout));

  var startNode = {
    data: start,
    g: 0,
    h: heuristic(start),
  };
  var bestNode = startNode;
  startNode.f = startNode.h;
  // leave .parent undefined
  var closedDataSet = new Set();
  var openHeap = new Heap(heapComparator);
  var openDataMap = new Map();
  openHeap.push(startNode);
  openDataMap.set(hash(startNode.data), startNode);
  var startTime = new Date();
  return await callbackEnd(isEnd, neighbor, distance, heuristic, timeout, hash, bestNode, closedDataSet, openHeap, openDataMap, startTime);
}

function callbackOneIt(isEnd, neighbor, distance, heuristic, timeout, hash, bestNode, closedDataSet, openHeap, openDataMap, startTime, resolve, reject) {
  if (!openHeap.size()) {
    return resolve({
      status: "noPath",
      cost: bestNode.g,
      path: reconstructPath(bestNode),
    });
  }
  if (new Date() - startTime > timeout) {
    return resolve({
      status: 'timeout',
      cost: bestNode.g,
      path: reconstructPath(bestNode),
    });
  }
  var node = openHeap.pop();
  openDataMap.delete(hash(node.data));
  if (isEnd(node.data)) {
    // done
    return resolve({
      status: 'success',
      cost: node.g,
      path: reconstructPath(node),
    });
  }
  // not done yet
  closedDataSet.add(hash(node.data));
  var neighbors = neighbor(node.data);
  bestNode = findNeighborsData(heuristic, distance, hash, bestNode, closedDataSet, openHeap, openDataMap, node, neighbors, 0);
  setImmediate(function() {
    callbackOneIt(isEnd, neighbor, distance, heuristic, timeout, hash, bestNode, closedDataSet, openHeap, openDataMap, startTime, resolve, reject); 
  });
}

function callbackEnd(isEnd, neighbor, distance, heuristic, timeout, hash, bestNode, closedDataSet, openHeap, openDataMap, startTime) {
  return new Promise(function (resolve, reject) {
    callbackOneIt(isEnd, neighbor, distance, heuristic, timeout, hash, bestNode, closedDataSet, openHeap, openDataMap, startTime, resolve, reject);
  });
}

function findNeighborsData(heuristic, distance, hash, bestNode, closedDataSet, openHeap, openDataMap, node, neighbors, i) {
  if (i >= neighbors.length)
    return bestNode;  
  var neighborData = neighbors[i];
  if (closedDataSet.has(hash(neighborData)))
    return findNeighborsData(heuristic, distance, hash, bestNode, closedDataSet, openHeap, openDataMap, node, neighbors, i + 1);
  var gFromThisNode = node.g + distance(node.data, neighborData);
  var neighborNode = openDataMap.get(hash(neighborData));
  var update = false;
  if (neighborNode === undefined) {
    // add neighbor to the open set
    neighborNode = {
      data: neighborData,
    };
    // other properties will be set later
    openDataMap.set(hash(neighborData), neighborNode);
  } else {
    if (neighborNode.g < gFromThisNode) {
      // skip this one because another route is faster
      return findNeighborsData(heuristic, distance, hash, bestNode, closedDataSet, openHeap, openDataMap, node, neighbors, i + 1);
    }
    update = true;
  }
  // found a new or better route.
  // update this neighbor with this node as its new parent
  neighborNode.parent = node;
  neighborNode.g = gFromThisNode;
  neighborNode.h = heuristic(neighborData);
  neighborNode.f = gFromThisNode + neighborNode.h;
  if (neighborNode.h < bestNode.h) bestNode = neighborNode;
  if (update) {
    openHeap.heapify();
  } else {
    openHeap.push(neighborNode);
  }
  return findNeighborsData(heuristic, distance, hash, bestNode, closedDataSet, openHeap, openDataMap, node, neighbors, i + 1);
}

function reconstructPath(node) {
  if (node.parent !== undefined) {
    var pathSoFar = reconstructPath(node.parent);
    pathSoFar.push(node.data);
    return pathSoFar;
  } else {
    // this is the starting node
    return [node.data];
  }
}

function defaultHash(node) {
  return node.toString();
}

function heapComparator(a, b) {
  return a.f - b.f;
}
