"""Build the isolated phyllotaxis scene through the native single-file builder."""
import importlib.util,json,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'tools'))
p=root/'lab/horizon/src/build.py';spec=importlib.util.spec_from_file_location('horizon_build',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
scripts=['../../agents/src/views.js','../../agents/src/sunflower.js']
html=m.RB.build({'src':m.PAGE,'title':'Data · Sunflower','scene':scripts,'data':False}).replace('<!--@lab-data-->',m.RB.data_js(),1)
f=root/'lab/agents/v4.html';f.write_text(html);f.with_suffix('.passport.json').write_text(m.passport('agents',4,'Data · Sunflower',html,None))
print('Built native sunflower data study')
