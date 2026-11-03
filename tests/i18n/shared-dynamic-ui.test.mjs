import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {translateUiText} from '../../src/lib/i18n/shared-ui-locale.mjs';

// Exercise the real native-selector client: browser render() must preserve
// prepared labels and its destination must remain in the current route tree.
const client=stripTypeScriptTypes(readFileSync(new URL('../../src/scripts/multi-country-selector.ts',import.meta.url),'utf8'))
  .replace(/^import[^\n]*\n/gm,'');

function runSelector(english) {
  const root=english?'/adatours-en/en/multi-country/':'/multi-country/';
  const origin=english?'https://alexyakovlev79.github.io':'https://adatours.ru';
  const navigations=[];
  const node=()=>({hidden:false,classList:{toggle(){}},listeners:{},
    addEventListener(name,handler){this.listeners[name]=handler;}});
  const selects=Array.from({length:4},()=>({...node(),value:'',options:[],
    replaceChildren(...options){this.options=options;this.value=options.find(x=>x.selected)?.value??'';},
    add(option){this.options.push(option);}}));
  const fields=Array.from({length:4},node),reset=node();
  const picker={dataset:{
    countries:JSON.stringify([{slug:'brazil',name:english?'Brazil':'Бразилия'},
      {slug:'chile',name:english?'Chile':'Чили'}]),
    combinations:JSON.stringify(['brazil_chile']),rootHref:root,currentRootHref:root,
    selected:'[]',interestOptions:'[]',theme:'',
  },querySelector(selector){return selector==='[data-mc-reset]'?reset:null;},
  querySelectorAll(selector){
    return selector==='[data-mc-field]'?fields:selector==='[data-mc-select]'?selects:[];
  }};
  const document={documentElement:{dataset:english?{adaSharedLocale:'en'}:{}},
    querySelectorAll(){return [picker];}};
  const window={location:{origin,pathname:root,hash:'',search:'',assign(url){navigations.push(url);}},
    sessionStorage:{getItem(){return null;},removeItem(){},setItem(){}}};
  class Option {
    constructor(text,value='',defaultSelected=false,selected=false){
      Object.assign(this,{text,value,defaultSelected,selected});
    }
  }
  vm.runInNewContext(client,{document,window,URL,Option,translateUiText,
    removeMultiCountrySelection(){throw Error('Unexpected removal during selection test');}});
  assert.equal(selects[0].options[0].text,english?'First country':'Первая страна');
  selects[0].value='brazil';selects[0].listeners.change();
  assert.equal(selects[1].options[0].text,english?'Second country':'Вторая страна');
  assert.equal(selects[1].options[1].text,english?'Chile':'Чили');
  selects[1].value='chile';selects[1].listeners.change();
  assert.deepEqual(navigations,[origin+root+'brazil_chile/']);
}

test('native country options remain English after rerender and keep the EN route namespace',()=>runSelector(true));
test('ordinary Russian selectors keep their labels and canonical routes',()=>runSelector(false));
