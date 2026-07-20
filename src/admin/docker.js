import Docker from 'dockerode';

const CONTAINER_NAME = process.env.BEDROCK_CONTAINER_NAME || 'bedrock';
let docker;

try {
  docker = new Docker({ socketPath: '/var/run/docker.sock' });
} catch {
  docker = null;
}

function getContainer() {
  if (!docker) throw new Error('Docker not available');
  return docker.getContainer(CONTAINER_NAME);
}

export function getDockerControl() {
  return {
    async getStatus() {
      const container = getContainer();
      const info = await container.inspect();
      return {
        running: info.State.Running,
        status: info.State.Status,
        startedAt: info.State.StartedAt,
      };
    },
    async start() { await getContainer().start(); },
    async stop() { await getContainer().stop(); },
    async restart() { await getContainer().restart(); },
  };
}
