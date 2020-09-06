const { execSync } = require('child_process');
const core = require('@actions/core');

const AWS_ACCESS_KEY_ID = core.getInput('access_key_id', { required: true });
const AWS_SECRET_ACCESS_KEY = core.getInput('secret_access_key', { required: true });
const remote_docker_host = core.getInput('remote_docker_host', { required: true });
const ssh_private_key = core.getInput('ssh_private_key', { required: true });
const ssh_public_key = core.getInput('ssh_public_key', { required: true });

const stack_file_name = core.getInput('stack_file_name', { required: true });
const project_name = core.getInput('project_name', { required: true });

const action = core.getInput('action', { required: true });

const awsRegion = core.getInput('region') || process.env.AWS_DEFAULT_REGION || 'us-east-1';

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

run(`echo "Registering SSH keys..."`);

// # register the private key with the agent.
run(`mkdir -p "$HOME/.ssh"`);
run(`printf '%s\n' "${ssh_private_key}" > "$HOME/.ssh/id_rsa"`);
run(`chmod 600 "$HOME/.ssh/id_rsa"`);
run(`eval $(ssh-agent) && ssh-add "$HOME/.ssh/id_rsa"`);

if (action === 'deploy') {
    run(
        `DOCKER_HOST="tcp://127.0.0.1:2375" docker-compose --log-level debug --host ssh://${remote_docker_host} -f ${stack_file_name} pull --ignore-pull-failures`
    );
    run(
        `DOCKER_HOST="tcp://127.0.0.1:2375" docker-compose -p ${project_name} --log-level debug --host ssh://${remote_docker_host} -f ${stack_file_name} up -d`
    );
}

if (action === 'remove') {
    run(
        `DOCKER_HOST="tcp://127.0.0.1:2375" docker-compose -p ${project_name} --log-level debug --host ssh://${remote_docker_host} -f ${stack_file_name} down -v`
    );
}
