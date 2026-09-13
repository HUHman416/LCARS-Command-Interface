import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read=(path)=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const page=read("../app/page.tsx"),files=read("../app/v31-files.tsx"),css=read("../app/v31-files.css"),linux=read("../local/lcars_bridge.py"),windows=read("../windows/lcars_bridge_windows.py"),service=read("../shared/lcars_files.py"),documents=read("../shared/lcars_documents.py"),builder=read("../electron-builder.yml");

test("Version 31.2 upgrades the existing Files station instead of adding a duplicate page",()=>{
  assert.match(page,/FileExplorer as FileExplorerV31/);
  assert.match(page,/<FileExplorerV31/);
  for(const phrase of ["FILES AND DOCUMENTS 2.0","RECENT","PLACES","TRASH","HISTORY","OPEN ROUTE","SAVE ROUTE","FOLDER ROUTE","DUPLICATE","RENAME","ARCHIVE","OPEN WITH","DEFAULT APPLICATION"])assert.match(files,new RegExp(phrase));
});

test("Files 2.0 has tabs, breadcrumbs, sorting, batch operations, jobs, conflicts, and bounded layouts",()=>{
  for(const token of ["file-tab-bar","breadcrumbs","aria-multiselectable","archive-create","archive-extract","empty-trash","set-default-app","file-operation-cancel","conflict"])assert.match(files,new RegExp(token));
  assert.match(service,/Path is outside the operator home and approved Places/);
  assert.match(service,/Archive contains an unsafe path/);
  assert.match(service,/history.*120/);
  assert.match(service,/cancelRequested/);
  assert.match(css,/@media\(max-height:780px\)/);
  assert.match(css,/@media\(max-width:680px\)/);
});

test("both desktop bridges expose the shared file service",()=>{
  for(const source of [linux,windows])for(const token of ["FileOperations","/api/file-hub","/api/file-properties","/api/file-operations","/api/file-operation","/api/file-operation-cancel"])assert.match(source,new RegExp(token));
  assert.match(builder,/shared\/lcars_files\.py/g);
});

test("Document Workspace adds recovery, find and replace, metadata, recent tracking, print and export routes",()=>{
  for(const phrase of ["RECOVERY DRAFT AVAILABLE","FIND / REPLACE","PROPERTIES","PRINT","SAVE AS","EXPORT TEXT","EXPORT MARKDOWN","EXPORT HTML","RECOVERY ACTIVE"])assert.match(files,new RegExp(phrase.replace("/","\\/")));
  assert.match(documents,/class DocumentWorkspaceStore/);
  assert.match(documents,/document-recovery/);
  assert.match(documents,/Recovery draft secured/);
  assert.match(documents,/Document exported as/);
});
