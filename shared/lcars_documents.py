"""Safe document reading/writing helpers for the embedded LCARS document host."""
from __future__ import annotations
import base64, hashlib, html, json, mimetypes, os, re, time, zipfile
from pathlib import Path
from xml.etree import ElementTree

TEXT_EXTENSIONS={".txt",".md",".log",".ini",".conf",".json",".csv",".tsv",".rtf"}

def safe_document_path(value:str):
    path=Path(value).expanduser().resolve();home=Path.home().resolve()
    if path!=home and home not in path.parents:raise PermissionError("Documents must be inside the current user home directory")
    if not path.is_file():raise FileNotFoundError("Document was not found")
    return path

def _office_text(path:Path):
    target="word/document.xml" if path.suffix.lower()==".docx" else "content.xml"
    with zipfile.ZipFile(path) as archive:data=archive.read(target)
    root=ElementTree.fromstring(data);parts=[]
    for element in root.iter():
        if element.text and element.text.strip():parts.append(element.text.strip())
        if element.tag.endswith(("}p","}h")):parts.append("\n")
    return re.sub(r"\n{3,}","\n\n"," ".join(parts).replace(" \n ","\n")).strip()

def read_document(value:str,path_guard=None):
    path=(path_guard(value) if path_guard else safe_document_path(value));suffix=path.suffix.lower();size=path.stat().st_size
    if not path.is_file():raise FileNotFoundError("Document was not found")
    if size>50*1024*1024:raise ValueError("Document exceeds the 50 MB embedded-viewer limit")
    stat=path.stat();metadata={"size":size,"modified":int(stat.st_mtime),"created":int(stat.st_ctime),"extension":suffix,"mime":mimetypes.guess_type(path.name)[0] or "application/octet-stream"}
    if suffix==".pdf":return {"kind":"pdf","name":path.name,"path":str(path),"editable":False,"content":"data:application/pdf;base64,"+base64.b64encode(path.read_bytes()).decode(),"metadata":metadata}
    if suffix in {".docx",".odt"}:return {"kind":"office","name":path.name,"path":str(path),"editable":False,"content":_office_text(path),"metadata":metadata}
    if suffix in TEXT_EXTENSIONS:return {"kind":"text","name":path.name,"path":str(path),"editable":suffix not in {".rtf"},"content":path.read_text(encoding="utf-8",errors="replace"),"metadata":metadata}
    raise ValueError("This file type uses the operating system's default application")

def write_document(value:str,content:str,path_guard=None):
    path=path_guard(value) if path_guard else safe_document_path(value)
    if not path.is_file():raise FileNotFoundError("Document was not found")
    if path.suffix.lower() not in TEXT_EXTENSIONS-{".rtf"}:raise PermissionError("This document format is read-only inside LCARS")
    encoded=str(content).encode("utf-8")
    if len(encoded)>8*1024*1024:raise ValueError("Editable documents are limited to 8 MB")
    temporary=path.with_suffix(path.suffix+".lcars-save");temporary.write_bytes(encoded);temporary.replace(path)
    return {"ok":True,"message":"Document saved","path":str(path)}


class DocumentWorkspaceStore:
    """Crash-safe drafts and bounded export routes for the LCARS document workspace."""

    def __init__(self, config_dir, path_guard=None):
        self.directory=Path(config_dir)/"document-recovery"
        self.path_guard=path_guard

    def _draft_path(self,value):
        path=self.path_guard(value) if self.path_guard else safe_document_path(value)
        if not path.is_file():raise FileNotFoundError("Document was not found")
        return path,self.directory/(hashlib.sha256(str(path).encode("utf-8")).hexdigest()+".json")

    def read(self,value):
        result=read_document(value,self.path_guard);path,draft=self._draft_path(value);recovery={"available":False}
        try:
            data=json.loads(draft.read_text(encoding="utf-8"))
            if data.get("path")==str(path) and int(data.get("updatedAt",0))>int(path.stat().st_mtime*1000):
                recovery={"available":True,"content":str(data.get("content","")),"updatedAt":int(data.get("updatedAt",0))}
        except Exception:pass
        result["recovery"]=recovery
        return result

    def operate(self,data):
        operation=str(data.get("operation","")).strip().lower();value=str(data.get("path",""));path,draft=self._draft_path(value)
        if operation=="autosave":
            content=str(data.get("content",""));encoded=content.encode("utf-8")
            if len(encoded)>8*1024*1024:raise ValueError("Recovery drafts are limited to 8 MB")
            self.directory.mkdir(parents=True,exist_ok=True);temporary=draft.with_suffix(".tmp")
            temporary.write_text(json.dumps({"path":str(path),"content":content,"updatedAt":int(time.time()*1000)}),encoding="utf-8");os.replace(temporary,draft)
            return {"ok":True,"message":"Recovery draft secured"}
        if operation=="save":
            result=write_document(value,str(data.get("content","")),self.path_guard);draft.unlink(missing_ok=True);return result
        if operation=="discard-recovery":
            draft.unlink(missing_ok=True);return {"ok":True,"message":"Recovery draft discarded"}
        if operation=="export":
            content=str(data.get("content",""));format_name=str(data.get("format","txt")).lower()
            suffix={"text":".txt","txt":".txt","markdown":".md","md":".md","html":".html"}.get(format_name)
            if not suffix:raise ValueError("LCARS export supports Text, Markdown, and HTML")
            destination=Path(str(data.get("destination") or path.with_suffix(suffix))).expanduser().resolve();home=Path.home().resolve()
            if destination!=home and home not in destination.parents:raise PermissionError("Document exports must remain inside the operator home directory")
            if destination.exists() and not bool(data.get("replace")):raise FileExistsError("The export destination already exists")
            destination.parent.mkdir(parents=True,exist_ok=True)
            output=f"<!doctype html><meta charset=\"utf-8\"><title>{html.escape(path.stem)}</title><pre>{html.escape(content)}</pre>" if suffix==".html" else content
            temporary=destination.with_suffix(destination.suffix+".lcars-export");temporary.write_text(output,encoding="utf-8");os.replace(temporary,destination)
            return {"ok":True,"path":str(destination),"message":f"Document exported as {suffix[1:].upper()}"}
        raise ValueError("Unknown document workspace operation")
