/**
 * Copyright 2021, Yahoo Inc.
 * Copyrights licensed under the BSD License. See the accompanying LICENSE file for terms.
 *
 * Usage:
 *   <GridStack
 *      @options={{hash animate=true}}
 *      @onDragstart={{this.dragStart}}
 *      @onDragstop={{this.dragStop}}
 *      @onResizestart={{this.resizeStart}}
 *      @onResizestop={{this.resizeStop}}
 *      @onAdded={{this.added}}
 *      @onChange={{this.change}}
 *      @onEnable={{this.enable}}
 *      @onRemoved={{this.remove}}
 *      as |grid|
 *   />
 *
 * Full list of options:
 *   https://github.com/gridstack/gridstack.js/tree/master/doc#grid-options
 */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { scheduleOnce, schedule } from '@ember/runloop';
import { capitalize } from '@ember/string';
import { guidFor } from '@ember/object/internals';
import { GridStackDDI } from 'gridstack';
import GridStack from 'gridstack-h5';

export const GRID_STACK_EVENTS = [
  'added',
  'change',
  'disable',
  'dragstart',
  'drag',
  'dragstop',
  'dropped',
  'enable',
  'removed',
  'resizestart',
  'resize',
  'resizestop',
];
 
 /*
 * Attaches the ids and events to the corresponding grids which are removed and added once again
 */
function attachGridIdsAndGridEventsToGrids(widget, grid){
  if(widget && grid!=undefined){
    /**
    * If the gird is `subGrid` then the parent item of that grid is assigned a `subGridId` else return
    */
    grid.id=widget['subGridId'];
    grid.gridstack.update(grid.closest('.grid-stack-item'), {subGridId:grid.id});
    grid.gridstack._gsEventHandler=widget['Events'];
    /**
    * copy only the items that have grids in them
    */
    let tempWidget=[];
    for(let j=0; j<widget['subGrid']['children'].length; j++) {
      if(widget['subGrid']['children'][j]['subGrid']!=undefined || widget['subGrid']['children'][j]['subGrid']!=null) {
        tempWidget.push(widget['subGrid']['children'][j]);
      }
    }
    /**
     * copy only the items that have grids in them
     */
    let gs=[];
    let el=grid.querySelector('.grid-stack-item');
    while(el){
      if(el.querySelector('.grid-stack')) gs.push(el.querySelector('.grid-stack'));
      el=el.nextElementSibling;
    }
    /**
    * call the function recursively is the `tempWidget` array item has subGrid in it
    */
    if(gs.length>0){
      for(let i=0; i<tempWidget.length; i++){
        if(tempWidget[i]['subGrid']!=undefined || tempWidget[i]['subGrid']!=null) attachGridIdsAndGridEventsToGrids(tempWidget[i], gs[i]);
      }
    }
  }
  else return;
}
 
/**
 * returns the `gs-gridstackid` attribute value of the passed item id
 */
function getGridstackid(Id, gridstackidsOfElements){
  for(let i=0; i<gridstackidsOfElements.length; i++){
    if(gridstackidsOfElements[i].id==Id) return gridstackidsOfElements[i].gridstackid;
  }
}

/**
 * assigns id and `gs-gridstackid` value to all the affected items by draaging or dropping
 */
function assignItemIds(element, gridstackidsOfElements){
  let allItems=element.querySelectorAll('.grid-stack-item');
  for(let i=0; i<allItems.length; i++){
      allItems[i].id=allItems[i].getAttribute('gs-id');
      allItems[i].setAttribute('gs-gridstackid', getGridstackid(allItems[i].id, gridstackidsOfElements))
  }
}
 
/**
 * removes the items that have no grids in them and stores them in `copiedWidgetItems` array
*/
function removeItemsWhichHaveNoGridsInIt(grid){
  let copiedWidgetItems=[];
  let copiedWidgetItemsIndex=0;
  let eles=grid.querySelectorAll('.grid-stack-item');
  for(let i=0; i<eles.length; i++){
      if(!(eles[i].querySelector('.grid-stack'))){
          copiedWidgetItems[copiedWidgetItemsIndex++]={ItemGridId:eles[i].closest('.grid-stack').id, Item:eles[i]};
          eles[i].closest('.grid-stack').gridstack.removeWidget(eles[i]);  //remove the items as widgets instead of raw HTML elements
      }
  }
  return copiedWidgetItems;
}

/**
 * stores the id and `gs-gridstackid` attribute value of all the items as array of objects in `gridstackidOfElements` array
*/
function storeGridStackIds(item){
  let gridstackidsOfElements=[];
  let object={};
  object.id=item.id;
  object.gridstackid=item.getAttribute('gs-gridstackid');
  gridstackidsOfElements.push(object);
  let items=item.querySelectorAll('.grid-stack-item');
  for(let i=0; i<items.length; i++){
    object={};
    object.id=items[i].id;
    object.gridstackid=items[i].getAttribute('gs-gridstackid');
    gridstackidsOfElements.push(object);
  }
  return gridstackidsOfElements;
}

function dargendSubFun(target){
  //items are removed and added only if the dragged item has grids inside them
  //if not nothing happens from here
  if(target.querySelector('.grid-stack')){
    let gridstackidsOfElements=[];
    gridstackidsOfElements=storeGridStackIds(target.closest('.grid-stack-item'));
    let copiedWidgetItems= removeItemsWhichHaveNoGridsInIt(target.querySelector('.grid-stack'));

    let Parent=target.closest('.grid-stack');
    let gridStack=Parent.gridstack;
    let ui=gridStack.save();
    let copiedWidget=null;
    
    for(let i=0; i<ui.length; i++){
      if(ui[i].id==target.closest('.grid-stack-item').id){
          copiedWidget=ui[i];  //saving the ui states of the dragged or dropped item to add it back again
          break;
        }
    }
    let parenGrid=target.closest('.grid-stack');
    gridStack.removeWidget(target.closest('.grid-stack-item'));   
    gridStack=parenGrid.gridstack;
    let element1=gridStack.addWidget(copiedWidget);
    if(target.querySelector('.grid-stack')){
        gridStack.update(element1, {subGridId:target.querySelector('.grid-stack').id});
    }
    element1.id=copiedWidget.id;
    element1.setAttribute('gs-gridstackid',getGridstackid(element1.id, gridstackidsOfElements));
    attachGridIdsAndGridEventsToGrids(copiedWidget, element1.querySelector('.grid-stack'));
    /**
     * Removed items that have no grids are added in the reverse order so that they stay in the same visual part of the screen when they were removed
    */
    for(let i=copiedWidgetItems.length-1; i>=0; i--){
      document.getElementById(copiedWidgetItems[i].ItemGridId).gridstack.addWidget(copiedWidgetItems[i].Item);
    }
    assignItemIds(element1, gridstackidsOfElements);
  }
}
 
export default class GridStackComponent extends Component {
  @service gridStackRegistry;

  guid = guidFor(this);
  @tracked elm;

  initialize(){
    this.elm=document.getElementById(this.guid);
    this._createGridStack();
  }

  constructor() {
    super(...arguments);
    this.gridStackRegistry.registerGrid(this.guid, this);
    scheduleOnce('afterRender', this, this.initialize);
  }

  get options() {
    return {
      ...this.args.options,
    };
  }

  /**
  * https://github.com/gridstack/gridstack.js/tree/master/doc#api
  * @property {GridStack|null} gridStack - reference to gridstack object
  */
  gridStack = null;

  /**
  * @property {Array} subscribedEvents - List of events for which event handlers were set up
  */
  subscribedEvents = [];

  _destroyGridStack() {
    const { gridStack } = this;

    if (gridStack) {
      this.subscribedEvents.forEach((eventName) => gridStack.off(eventName));
      this.subscribedEvents = [];

      // Use `false` option to prevent removing dom elements, let Ember do that
      gridStack.destroy(false);

      this.gridStack = null;

      // Remove 'grid-stack-instance-####' class left behind
      [...this.elm.classList]
        .filter((x) => /grid-stack-instance-\d*/.test(x))
        .forEach((x) => this.elm.classList.remove(x));
    }
  }

  _createGridStack() {
    if(!this.elm) return;
    this.gridStack = GridStack.init({ ...this.options }, this.elm);

    GRID_STACK_EVENTS.forEach((eventName) => {
      const action = this.args[`on${capitalize(eventName)}`];

      if (action) {
        this.gridStack.on(eventName, function () {
          scheduleOnce('afterRender', this, action, ...arguments);
        });

        this.subscribedEvents.push(eventName);
      }
    }); 
  }
 
  /**
   * Does all the process of removing and adding the items back onn dragging or dropping
  */
  @action
  dragend(x){
    x.stopPropagation();
    dargendSubFun(x.target);
  }

  @action
  update() {
    this._destroyGridStack();
    this._createGridStack();
  }

  @action
  willDestroyNode() {
    this.gridStackRegistry.unregisterGridComponent(this.guid, this);
    this._destroyGridStack();
  }

  @action
  addWidget(element) {
    this.gridStack?.makeWidget(element);
  }

  /**
  * Custom removeWidget function that skips check to see if widget is in current grid
  * @see https://github.com/gridstack/gridstack.js/blob/v4.2.5/src/gridstack.ts#L893
  */
  @action
  removeWidget(element, removeDOM = false, triggerEvent = true) {
    GridStack.getElements(element).forEach((el) => {
      // The following line was causing issues because this hook is called correctly from
      // child widgets, but after they are already removed from the dom
      // --- SKIP ---
      // if (el.parentElement !== this.el) return; // not our child!
      // --- SKIP ---
      let node = el.gridstackNode;
      // For Meteor support: https://github.com/gridstack/gridstack.js/pull/272
      if (!node) {
        node = this.gridStack?.engine.nodes.find((n) => el === n.el);
      }
      if (!node) return;

      // remove our DOM data (circular link) and drag&drop permanently
      delete el.gridstackNode;
      GridStackDDI.get().remove(el);

      this.gridStack?.engine.removeNode(node, removeDOM, triggerEvent);

      if (removeDOM && el.parentElement) {
        el.remove(); // in batch mode engine.removeNode doesn't call back to remove DOM
      }
    });
    if (triggerEvent) {
      this.gridStack?._triggerRemoveEvent();
      this.gridStack?._triggerChangeEvent();
    }
    return this;
  }
}