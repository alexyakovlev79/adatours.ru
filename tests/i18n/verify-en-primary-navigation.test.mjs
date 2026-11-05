import test from 'node:test';
import assert from 'node:assert/strict';
import {primaryEnglishMenuLabels} from '../../scripts/i18n/verify-en-primary-navigation.mjs';
test('primary EN menu excludes untranslated RU submenu labels',()=>{
 const html='<html><header data-site-header><nav class="desktop-nav"><a>Tours</a>'+
 '<div class="desktop-nav__group"><a class="desktop-nav__parent">Countries</a>'+
 '<div class="desktop-nav__submenu"><a>Непереведённая страна</a></div></div>'+
 '<a>Contact us</a></nav></header></html>';
 assert.deepEqual(primaryEnglishMenuLabels(html),['Tours','Countries','Contact us']);
 assert.deepEqual(primaryEnglishMenuLabels('<html></html>'),[]);
});
