/** Extract the one new deployment URL from `vercel deploy` output; null unless unambiguous. */
const deployment=/^https:\/\/[a-z0-9.-]+\.vercel\.app\/?$/i;
// Quiet/FORCE_TTY mode prints the bare URL to stdout; CLI 63 with a piped stdout prints it only on the stderr "Production" row.
// The "Aliased" row is the project alias, never the staged deployment.
export function deploymentUrl(stdout,stderr){
  const clean=text=>text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g,'').split(/[\r\n]+/);
  const bare=clean(stdout).flatMap(line=>line.split(/\s+/)).filter(s=>deployment.test(s));
  const labelled=clean(stderr).map(line=>line.match(/^\W*Production\s+(\S+)\s*$/)?.[1]).filter(s=>s&&deployment.test(s));
  const urls=new Set([...bare,...labelled].map(s=>s.replace(/\/$/,'')));
  return urls.size===1?[...urls][0]:null;
}
