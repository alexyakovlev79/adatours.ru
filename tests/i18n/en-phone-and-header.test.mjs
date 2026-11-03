import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { findCountryForGeoIp } from '../../src/lib/i18n/phone-country-detection.mjs';

test('GeoIP maps known country without retaining IP or guessing unsupported codes',()=>{
 const countries=[{iso2:'us',dial:'+1'},{iso2:'ru',dial:'+7'},{iso2:'nl',dial:'+31'}];
 assert.equal(findCountryForGeoIp({ip:'203.0.113.9',country:'NL'},countries).dial,'+31');
 assert.equal(findCountryForGeoIp({country:'ZZ'},countries),null);
 assert.equal(findCountryForGeoIp({country:'Netherlands'},countries),null);
 assert.equal(findCountryForGeoIp(null,countries),null);
});
test('EN uses a wider shared header breakpoint while RU retains 1240px',()=>{
 const source=fs.readFileSync('src/components/global/SiteHeader.astro','utf8');
 assert.match(source,/@media \(max-width: 1600px\)/);
 assert.match(source,/@media \(min-width: 1241px\) and \(max-width: 1600px\)/);
 assert.match(source,/\.site-header:not\(\[data-ui-locale='en'\]\) \.desktop-nav/);
});
test('RU telephone default is fixed; EN fetches only country and never changes manual input',()=>{
 const source=fs.readFileSync('src/components/forms/PhoneField.astro','utf8');
 assert.match(source,/sharedUiLocale\(\) === 'en' \? 'us' : 'ru'/);
 assert.match(source,/document\.documentElement\.dataset\.adaSharedLocale === 'en'/);
 assert.match(source,/https:\/\/api\.country\.is\//);
 assert.match(source,/manuallySelected \|\| input\.value\.trim\(\)/);
});
test('backend allows EN staging project without accepting unrelated GitHub sites',()=>{
 const source=fs.readFileSync('serverless/adatours-form/index.py','utf8');
 assert.match(source,/parsed\.path\.startswith\("\/adatours-en\/"\)/);
 assert.match(source,/host == "alexyakovlev79.github.io"/);
});
