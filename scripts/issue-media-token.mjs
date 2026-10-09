import { readFileSync, writeFileSync } from 'node:fs';
import { sealUploadToken, validateSessionRequest } from './lib/media-token-envelope.mjs';

const requestFile = process.argv[2] || 'data/media/upload-session-request.json';
const token = process.env.YC_MEDIA_IAM_TOKEN;
if (!token) throw new Error('Missing YC_MEDIA_IAM_TOKEN environment variable');
const request = JSON.parse(readFileSync(requestFile, 'utf8'));
validateSessionRequest(request);
const envelope = sealUploadToken(token, request);
const result = JSON.stringify(envelope);
const outputFile = process.env.MEDIA_ENVELOPE_OUTPUT || 'media-upload-session-envelope.json';
writeFileSync(outputFile, result + '\n', { mode: 0o600 });
console.log('Upload session issued: ' + request.requestId);
console.log('Encrypted packet only (never contains a plaintext IAM credential):');
console.log('SEALED_MEDIA_TOKEN=' + Buffer.from(result).toString('base64'));
console.log('The recipient must keep its private X25519 key outside Git and chat.');
