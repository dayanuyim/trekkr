import symbols from './data/symbols.json';
import rules from './data/symbol-rules.json';

const Sym_dir = './images/sym';
export const Def_symbol = symbols['waypoint'];

rules.forEach(r => {
    if(r.type == "regex" && typeof r.text === "string"){
        r.txet = RegExp(r.text);
    }
});

Object.values<any>(symbols).forEach(s => {
  s.path = (size=32) => `${Sym_dir}/${size}/${s.filename}`;
});

export function getSymbol(name){
  if(!name)   // may be a track point
    return undefined;

  const id = name.toLowerCase();  //lowercase as id
  const symbol = symbols[id];
  if(symbol) return symbol;

  console.error(`The symbol '${name}' is not found, use default symbol '${Def_symbol.name}'`);
  return Def_symbol;
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
