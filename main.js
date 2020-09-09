const { execSync } = require('child_process');
const core = require('@actions/core');

const remote_docker_host = core.getInput('remote_docker_host', { required: true });
const ssh_private_key = core.getInput('ssh_private_key', { required: true });
const project_name = core.getInput('project_name', { required: true });
const action = core.getInput('action', { required: true });

const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const stack_file_name = core.getInput('stack_file_name') || 'docker-compose.yml';
const awsRegion = process.env.AWS_DEFAULT_REGION;

function run(cmd, options = {}) {
    if (!options.hide) {
        console.log(`$ ${cmd}`);
    }
    return execSync(cmd, {
        shell: '/bin/bash',
        encoding: 'utf-8',
        env: {
            ...process.env,
            AWS_ACCESS_KEY_ID,
            AWS_SECRET_ACCESS_KEY,
        },
    });
}

run(`$(aws ecr get-login --no-include-email --region ${awsRegion})`);

const accountData = run(`aws sts get-caller-identity --output json`);
const awsAccountId = JSON.parse(accountData).Account;

// # register the private key with the agent.
run(`echo "Registering SSH keys..."`);
run(`mkdir -p "$HOME/.ssh"`);
run(`printf '%s\n' "${ssh_private_key}" > "$HOME/.ssh/id_rsa"`);
run(`chmod 600 "$HOME/.ssh/id_rsa"`);
run(`eval $(ssh-agent) && ssh-add "$HOME/.ssh/id_rsa"`);

switch (action) {
    case 'deploy':
        run(`echo "Pull Built Images..."`);
        run(
            `docker-compose --log-level debug --host ssh://${remote_docker_host} -f ${stack_file_name} pull --ignore-pull-failures`
        );
        run(`echo "Start ${project_name} Services..."`);
        run(
            `docker-compose -p ${project_name} --log-level debug --host ssh://${remote_docker_host} -f ${stack_file_name} up -d`
        );
        break;

    case 'remove':
        run(`echo "Stop ${project_name} Services..."`);
        run(
            `docker-compose -p ${project_name} --log-level debug --host ssh://${remote_docker_host} -f ${stack_file_name} down -v`
        );
        break;
}
