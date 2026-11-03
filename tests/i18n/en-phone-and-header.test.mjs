import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { findCountryForGeoIp } from '../../src/lib/i18n/phone-country-detection.mjs';

test('GeoIP maps both country.is and CORS provider payloads without guessing',()=>{
 const countries=[{iso2:'us',dial:'+1'},{iso2:'ru',dial:'+7'},{iso2:'nl',dial:'+31'},{iso2:'de',dial:'+49'}];
 assert.equal(findCountryForGeoIp({ip:'203.0.113.9',country:'NL'},countries).dial,'+31');
 assert.equal(findCountryForGeoIp({country_code:'DE',city:'Berlin'},countries).dial,'+49');
 assert.equal(findCountryForGeoIp({countryCode:'de'},countries).dial,'+49');
 for (const payload of [null,{country:'ZZ'},{country:'Netherlands'},{success:false,country_code:'DE'},
                        {error:true,country_code:'DE'}])
   assert.equal(findCountryForGeoIp(payload,countries),null);
});
test('EN uses a wider shared header breakpoint while RU retains 1240px',()=>{
 const source=fs.readFileSync('src/components/global/SiteHeader.astro','utf8');
 assert.match(source,/@media \(max-width: 1600px\)/);
 assert.match(source,/@media \(min-width: 1241px\) and \(max-width: 1600px\)/);
 assert.match(source,/\.site-header:not\(\[data-ui-locale='en'\]\) \.desktop-nav/);
});
test('EN has no artificial US default and retries IP lookup while RU remains +7',()=>{
 const source=fs.readFileSync('src/components/forms/PhoneField.astro','utf8');
 const checks=[
   "const isEnglishPhone = sharedUiLocale() === 'en';",
   "isEnglishPhone ? 'Country' : defaultCountry.dial",
   "value={isEnglishPhone ? '' : defaultCountry.iso2}",
   "readonly={isEnglishPhone}",
   'https://ipapi.co/json/',
   'https://ipwho.is/',
   'https://api.country.is/',
   'manuallySelected || input.value.trim()',
   "field.dataset.phoneGeo = 'unavailable'",
   "document.documentElement.dataset.adaSharedLocale === 'en'",
 ];
 for (const text of checks) assert.ok(source.includes(text),text);
});
test('backend allows EN staging project without accepting unrelated GitHub sites',()=>{
 const source=fs.readFileSync('serverless/adatours-form/index.py','utf8');
 assert.match(source,/parsed\.path\.startswith\("\/adatours-en\/"\)/);
 assert.match(source,/host == "alexyakovlev79.github.io"/);
});
