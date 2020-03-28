import * as Handlebars from 'handlebars/dist/handlebars';

Handlebars.registerHelper("inc", (value, options) => parseInt(value)+1);
Handlebars.registerHelper("indexOf", (arr, elem, options) => arr.indexOf(elem));
Handlebars.registerHelper("at", (arr, elem, options) => arr[elem]);

const evalCond = (v1, operator, v2) => {
    switch (operator) {
        case '==':  return (v1 == v2);
        case '===': return (v1 === v2);
        case '!=':  return (v1 != v2);
        case '!==': return (v1 !== v2);
        case '<':   return (v1 < v2);
        case '<=':  return (v1 <= v2);
        case '>':   return (v1 > v2);
        case '>=':  return (v1 >= v2);
        case '&&':  return (v1 && v2);
        case '||':  return (v1 || v2);
        default:    return false;
    }
}

Handlebars.registerHelper('ifcond', function (v1, operator, v2, options) {
    return evalCond(v1, operator, v2)? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('ifeql', function (v1, v2, options) {
    return v1 === v2? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('ifzero', function (v, options) {
    return v === 0? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper("nonzero", (value, text, options) =>{
    return value !== 0? text: "";
});

Handlebars.registerHelper("math", function(lvalue, operator, rvalue, options) {
    lvalue = parseFloat(lvalue);
    rvalue = parseFloat(rvalue);
    switch(operator){
        case "+": return lvalue + rvalue;
        case "-": return lvalue - rvalue;
        case "*": return lvalue * rvalue;
        case "/": return lvalue / rvalue;
        case "%": return lvalue % rvalue;
    }
});

Handlebars.registerHelper('times', (n, options)=>{
    let acc = '';
    for(let i = 0; i < n; ++i){
        options.data.index = i;
        options.data.first = i === 0;
        options.data.last = i === (n-1);
        acc += options.fn(this);
    }
    return acc;
});

Handlebars.registerHelper('if_even', (num, options)=>{
    return (num % 2 == 0)? options.fn(this): options.inverse(this);
});

Handlebars.registerHelper('if_odd', (num, options)=>{
    return (num % 2 == 1)? options.fn(this): options.inverse(this);
});

Handlebars.registerHelper('toParams', (params, options)=>{
    let ps = '';
    for(let key in params){
        if(ps.length > 0) 
            ps += '&'
        ps += key + '=' + params[key];
    }
    if (ps.length > 0) 
        ps = '?' + ps;
    return ps;
});