import symbols from './data/symbols.json';
import rules from './data/symbol-rules.json';

rules.forEach(r => {
    if(r.type == "regex" && typeof r.text === "string"){
        r.txet = RegExp(r.text);
    }
});

const symDir = './images/sym';
export function toSymPath(sym, size=32)
{
  return `${symDir}/${size}/${sym.filename}`;
}

export function getSymbol(symName){
  if(!symName)   // may be a track point
    return undefined;

  const id = symName.toLowerCase();
  const sym = symbols[id];
  if(!sym){
    console.log(`The symbol '${symName}' is not found`)
    return symbols['waypoint'];
  }
  return sym;
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
