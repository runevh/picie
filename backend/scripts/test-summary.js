const fs = require('fs');

const reportPath = 'test-results.json';
let summary = '## Backend authorization tests\n\n';

if (!fs.existsSync(reportPath)) {
  summary += 'Tests did not produce a report. Check the installation and test logs.\n';
} else {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  summary += `**${report.success ? 'Passed' : 'Failed'}** — ${report.numPassedTests} passed, ${report.numFailedTests} failed, ${report.numPendingTests} skipped.\n`;
  const failures = report.testResults.flatMap(suite =>
    suite.assertionResults.filter(test => test.status === 'failed').map(test => test.fullName)
  );
  if (failures.length) {
    summary += '\nFailed tests:\n' + failures.map(name => `- ${name}`).join('\n') + '\n';
  }
}

summary += '\nScope: device album authorization and photo delivery.\n';
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
} else {
  process.stdout.write(summary);
}
