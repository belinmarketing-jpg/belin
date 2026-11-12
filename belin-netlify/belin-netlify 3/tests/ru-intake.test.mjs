import test from 'node:test';
import assert from 'node:assert/strict';
import {publicLeadConfig} from '../netlify/functions/studio-leads.mjs';

test('normal form is routed directly to the configured HTTPS Russian backend, never the Netlify collector',()=>{
 assert.equal(publicLeadConfig({BELIN_STUDIO_FORMS_ENABLED:'true'}).enabled,false);
 assert.equal(publicLeadConfig({BELIN_STUDIO_FORMS_ENABLED:'true',BELIN_RU_LEADS_ORIGIN:'http://forms.example.test'}).enabled,false);
 const c=publicLeadConfig({BELIN_STUDIO_FORMS_ENABLED:'true',BELIN_RU_LEADS_ORIGIN:'https://forms.example.test'});
 assert.equal(c.endpoint,'https://forms.example.test/leads');assert.equal(c.documentsURL,'https://forms.example.test/documents');assert.equal(c.enabled,true);
});
