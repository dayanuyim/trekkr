import symbols from './data/symbols.json';
import rules from './data/symbol-rules.json';

const Sym_dir = './images/sym';
const Def_sym_name = 'waypoint';

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

  name = name.toLowerCase();
  const symbol = symbols[name];
  if(!symbol){
    console.log(`The symbol '${name}' is not found, use default symbol '${Def_sym_name}'`);
    return symbols[Def_sym_name];
  }
  return symbol;
}

export function matchRules(str){
    const rule = rules.find(r => {
        return r.enabled && matchRule(str, r.type, r.text);
    });
    return rule? rule.symbol: undefined;
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
