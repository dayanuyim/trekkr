import symbols from './data/symbols.json';
import rules from './data/symbol-rules.json';
import inv from './data/symbol-inventory.json';

const sym_dir = './images/sym';

///////////////////////////////////////////////////////

Object.values<any>(symbols).forEach(s => {
  s.path = (size=32) => `${sym_dir}/${size}/${s.filename}`;
});

rules.forEach(r => {
    if(r.type == "regex" && typeof r.text === "string"){
        r.txet = RegExp(r.text);
    }
});

export const def_symbol = symbols['waypoint'];

export const symbol_inv = {
  basics: inv.basics.map(getSymbol),
  extras: inv.extras.map(getSymbol),
};

///////////////////////////////////////////////////////

export function getSymbol(name){
  if(!name)   // may be a track point
    return undefined;

  const id = name.toLowerCase();  //lowercase as id
  const symbol = symbols[id];
  if(symbol) return symbol;

  console.error(`The symbol '${name}' is not found, use default symbol '${def_symbol.name}'`);
  return def_symbol;
}

export function matchRules(str){
    const rule = rules.find(r => {
        return r.enabled && matchRule(str, r.type, r.text);
    });
    return rule? getSymbol(rule.sym): undefined;
}

function matchRule(str: string, type: string, text: string){
    switch(type){
        case "contains":   return str.includes(text);
        case "startswith": return str.startsWith(text);
        case "endswith":   return str.endsWith(text);
        case "equals":     return str == text;
        case "regex":      return str.match(text);
        default:           return undefined;
    };
}
