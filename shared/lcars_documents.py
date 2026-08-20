"""Safe document reading/writing helpers for the embedded LCARS document host."""
from __future__ import annotations
import base64, html, mimetypes, re, zipfile
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

def read_document(value:str):
    path=safe_document_path(value);suffix=path.suffix.lower();size=path.stat().st_size
    if size>50*1024*1024:raise ValueError("Document exceeds the 50 MB embedded-viewer limit")
    if suffix==".pdf":return {"kind":"pdf","name":path.name,"path":str(path),"editable":False,"content":"data:application/pdf;base64,"+base64.b64encode(path.read_bytes()).decode()}
    if suffix in {".docx",".odt"}:return {"kind":"office","name":path.name,"path":str(path),"editable":False,"content":_office_text(path)}
    if suffix in TEXT_EXTENSIONS:return {"kind":"text","name":path.name,"path":str(path),"editable":suffix not in {".rtf"},"content":path.read_text(encoding="utf-8",errors="replace")}
    raise ValueError("This file type uses the operating system's default application")

def write_document(value:str,content:str):
    path=safe_document_path(value)
    if path.suffix.lower() not in TEXT_EXTENSIONS-{".rtf"}:raise PermissionError("This document format is read-only inside LCARS")
    encoded=str(content).encode("utf-8")
    if len(encoded)>8*1024*1024:raise ValueError("Editable documents are limited to 8 MB")
    temporary=path.with_suffix(path.suffix+".lcars-save");temporary.write_bytes(encoded);temporary.replace(path)
    return {"ok":True,"message":"Document saved","path":str(path)}
