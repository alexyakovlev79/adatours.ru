#!/usr/bin/env python3
"""Read a local DOCX into stable, version-scoped text segments; never edits it.

Usage: python3 extract-word-segments.py source.docx output.json
Only standard-library dependencies. Content refs are meaningful only with the
exact sourceSha256. PDF/DOC/OCR are intentionally outside this extractor.
"""
import argparse, hashlib, json, re, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
def tag(name): return '{'+W+'}'+name
def own_paragraph_text(p):
    """Preserve hard breaks/tabs and avoid double-counting nested text boxes."""
    out=[]
    def visit(e):
        if e is not p and e.tag==tag('p'):return
        if e.tag in {tag('del'),tag('delText'),tag('instrText')}:return
        if e.tag==tag('t'):out.append(e.text or '')
        elif e.tag==tag('tab'):out.append('\t')
        elif e.tag in {tag('br'),tag('cr')}:out.append('\n')
        elif e.tag==tag('noBreakHyphen'):out.append('\u2011')
        elif e.tag==tag('softHyphen'):out.append('\u00ad')
        else:
            for c in e:visit(c)
    visit(p)
    return ''.join(out)
def extract(src):
    raw=src.read_bytes();segments=[];parts=[];tables=[];external=[];tracked=0
    with zipfile.ZipFile(src) as z:
        names=[n for n in z.namelist() if re.fullmatch(r'word/(document|header\d+|footer\d+|footnotes|endnotes)\.xml',n)]
        names.sort(key=lambda n:(n!='word/document.xml',n))
        for name in names:
            root=ET.fromstring(z.read(name));parents={c:p for p in root.iter() for c in p};parts.append(name)
            tracked+=sum(e.tag in {tag('ins'),tag('del'),tag('moveFrom'),tag('moveTo')} for e in root.iter())
            ps=list(root.iter(tag('p')));p_index={id(p):i for i,p in enumerate(ps)}
            for i,p in enumerate(ps):
                text=own_paragraph_text(p)
                if not text.strip():continue
                ancestors=[];q=p
                while q in parents:q=parents[q];ancestors.append(q.tag)
                segments.append({'sourceRef':f'{name}#p{i:04d}','part':name,'paragraphIndex':i,'text':text,'textSha256':hashlib.sha256(text.encode()).hexdigest(),'inTable':tag('tbl') in ancestors,'inTextBox':tag('txbxContent') in ancestors})
            for i,tbl in enumerate(root.iter(tag('tbl'))):
                rows=[]
                for row in tbl.findall(tag('tr')):
                    rows.append([{'paragraphRefs':[f'{name}#p{p_index[id(p)]:04d}' for p in cell.iter(tag('p'))],'text':'\n'.join(own_paragraph_text(p) for p in cell.iter(tag('p')) if own_paragraph_text(p).strip())} for cell in row.findall(tag('tc'))])
                tables.append({'sourceRef':f'{name}#table{i:04d}','rows':rows})
        for name in z.namelist():
            if name.endswith('.rels'):
                root=ET.fromstring(z.read(name))
                external += [{'part':name,'relationshipId':e.get('Id'),'relationshipType':e.get('Type'),'target':e.get('Target')} for e in root if e.get('TargetMode')=='External']
    return {'schemaVersion':1,'extractorVersion':'docx-segments-v1','sourceSha256':hashlib.sha256(raw).hexdigest(),'sourceBytes':len(raw),'parts':parts,'trackedChangeCount':tracked,'requiresTrackedChangesReview':bool(tracked),'segments':segments,'tables':tables,'externalRelationships':external,'limitation':'Paragraph order is OOXML order, not guaranteed visual reading order. Text in images, diagrams/charts and embedded objects requires explicit review; they are never silently treated as translated.'}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('output',type=Path);args=p.parse_args()
    result=extract(args.source);args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'sourceSha256':result['sourceSha256'],'segments':len(result['segments']),'tables':len(result['tables']),'trackedChangeCount':result['trackedChangeCount']}))
