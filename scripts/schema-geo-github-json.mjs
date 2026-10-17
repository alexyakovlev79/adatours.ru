// GitHub Contents API omits inline data for files over 1 MB (encoding: "none").
// Use the immutable Git blob SHA instead of retrying the empty payload.
export async function readGitHubJsonFile(request,path,ref){
 const item=await request('/contents/'+path+'?ref='+encodeURIComponent(ref));
 let encoded=item?.encoding==='base64'?item.content:null;
 if(!encoded){
  if(!/^[a-f0-9]{40}$/i.test(item?.sha||''))
   throw Error('Missing immutable Git blob SHA for '+path);
  const blob=await request('/git/blobs/'+item.sha);
  if(blob?.encoding!=='base64'||typeof blob.content!=='string'||!blob.content)
   throw Error('Git blob did not return base64 content for '+path);
  encoded=blob.content;
 }
 if(typeof encoded!=='string')throw Error('Invalid GitHub contents for '+path);
 return JSON.parse(Buffer.from(encoded.replace(/\s/g,''),'base64').toString('utf8'));
}
