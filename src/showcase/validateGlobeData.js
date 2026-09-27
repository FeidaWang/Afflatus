export function validateGlobeData(data) {
  const errors=[];
  for(const [key,stride,radius] of [['points',3,1.004],['coast',6,1.003]]) {
    const values=data?.[key];
    if(!Array.isArray(values) || !values.length || values.length%stride || values.length>300000 || !values.every(Number.isFinite)) {
      errors.push(`${key} must contain bounded finite XYZ tuples`); continue;
    }
    for(let i=0;i<values.length;i+=3) {
      if(Math.abs(Math.hypot(values[i],values[i+1],values[i+2])-radius)>.0001) {errors.push(`${key} must lie on its globe shell`);break;}
    }
  }
  return {ok:errors.length===0,errors};
}
