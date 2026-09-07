# Service and container resources and hardware

## User-facing contract

The **Resources and hardware** tab uses the existing LaunchConfig, for both
standalone containers and service primary/secondary containers. It does not
introduce a parallel configuration store. The container details route has a
read-only version of the same form; monitoring remains in the parent route.

The existing application style and translation system are retained. New guidance
is supplied in all 13 shipped locales. These controls target **Linux** hosts;
Windows isolation remains in the Security form.

| Setting | Form and serialized contract |
| --- | --- |
| Shared memory | Optional size with MiB/GiB units; `2g` becomes `shmSize: 2147483648`. Changing units preserves bytes. Clearing restores Docker's default. This is a `/dev/shm` size limit, not a RAM reservation. |
| CPU | CPU core limit maps to `cpuQuota`/`cpuPeriod`. Existing shares and memory controls retain their separate meanings. |
| IPC | Default/private/shareable/host/none; imported container-specific values remain visible. A positive shared-memory size cannot accompany host/none/container IPC. |
| NVIDIA GPUs | None, explicit UUIDs, count, or all. Uses `deviceRequests` with nested capabilities; count and IDs are mutually exclusive. |
| Graphics devices | Select actual DRM card/render nodes or `/dev/kfd`. Adds exact `source:target:rw` mappings and the host's numeric device GID to `groupAdd`. |
| Runtime | Select names reported by the chosen Docker daemon. Preserve an imported value; report missing prerequisites rather than silently substituting a runtime. |
| Advanced options | PID limit, init, CPU quota/period, tmpfs, sysctls and ulimits. Signed unlimited values such as `-1` are not stripped by numeric inputs. |

Resources and device bindings are edited in one place, rather than duplicated in
the Security tab. Manual device bindings remain available. All supported shorthand
forms are preserved: `/dev/node`, `/dev/node:rw`, `/dev/node:/dev/node`, and
`/dev/node:/dev/node:rw`.

The host IP column in port mappings is visible in the service form. An empty
address means all interfaces; `127.0.0.1` binds IPv4 loopback; an explicit address
is retained. Existing port conflict and volume placement preflights still apply.
Standalone containers expose Docker `unless-stopped`. A service's maintained
replica count is a different lifecycle policy; the form explains this distinction.

## Hardware discovery and placement

The node agent publishes `host.info.hardwareInfo` through the existing host-info
collector. It reports runtime names/default, collection time, inventory status,
NVIDIA kernel-reported model/UUID, and DRM vendor/device identifiers, PCI address,
driver, device path and numeric GID. It does not install drivers or invoke GPU
vendor programs. Virtual VMware graphics are identified as VMware, not Intel.

GPU/runtime/DRM configuration requires a selected active host and an available
inventory no more than ten minutes old. Shared memory and ordinary resource
limits alone do **not** require a fixed host. A sidekick without an override uses
its primary container's selected host. Switching hosts revalidates GPU IDs, device
nodes, GIDs and runtime; it cannot fall back to another host's old inventory.
Validation runs again on Save, including configurations in hidden sidekick forms.

Device count controls **visibility**, not exclusive allocation. This release does
not add a GPU quota pool, exclusive reservations, topology-aware automatic
scheduling, MIG discovery, or CDI device support. CDI names are explicitly rejected
by the legacy device-path parser. Do not rely on replicas receiving disjoint GPUs.
Local named volumes also remain host-local; selecting another GPU host does not
move their data.

Discovery is not proof that a workload can use an accelerator:

- NVIDIA requires a working host driver and Container Toolkit integration. The
  form checks reported NVIDIA devices, runtime registration and request support.
  Container images may additionally need the correct driver capabilities and
  user-space libraries for CUDA, graphics or video.
- Intel/AMD graphics or media workloads need the appropriate selected render
  node, supplementary GID and compatible image libraries. Card nodes should only
  be selected when the workload actually needs them.
- ROCm workloads typically require `/dev/kfd` plus the relevant DRM node and
  groups. Presence of these nodes does not certify the GPU, kernel, ROCm version
  or image as a supported combination.

The form never automatically enables privileged mode, host IPC, extra Linux
capabilities, or unconfined security profiles. Removing an automatically selected
device does not delete a potentially user-owned supplementary group.

Capacity, ulimit names, tmpfs paths/options and common sysctl names offer keyboard
autocomplete without forcing a preset. GPU choices are enabled only for a ready
host; count is bounded by its inventory. Incomplete or duplicate advanced rows
block Save, and invalid drafts survive switching between primary and sidekick
containers. Drafts are kept out of the API payload. Host selection never silently
allocates all GPUs or replaces an imported runtime.

## API and Compose contract

The orchestration engine adds typed and authorized `runtime` and `deviceRequests`
fields to the shared container/LaunchConfig schema. Creation and service upgrades
validate shared memory/IPC, signed CPU/PID limits, ulimits, map shape and device
request structure, even when the caller bypasses the UI. The node agent maps them
to Docker HostConfig and preserves them when reading Docker inspect data.

The bundled Compose parser supports `runtime`, `pids_limit`, `gpus: all`, the GPU
request list form, and `deploy.resources.reservations.devices`. Existing
`shm_size`, `devices`, `group_add`, CPU/memory and port mappings continue through
the same conversion path. This is **not** a claim of full Docker Compose `deploy`
support: unrelated deploy settings are rejected rather than silently ignored.

For example, a service can request:

```yaml
version: '2'
services:
  worker:
    image: your-approved-workload:version
    shm_size: 2g
    runtime: nvidia
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              device_ids: [GPU-your-selected-uuid]
              capabilities: [gpu]
```

Count and IDs cannot be combined. Do not combine the `gpus` shortcut with
`deploy.resources.reservations.devices`. Export uses the latter structure.
Requests with multiple alternative capability groups cannot be represented by
Compose's flat capability list; export reports that limitation instead of
flattening it into a different request. Imported advanced/custom requests remain
intact and visible as read-only data in the simple GPU editor.

## Validation and rollout boundaries

Focused tests cover real browser rendering, units, `-1`, GPU/DRM selection,
host/GID changes, sidekick inheritance and configuration switching, translated
guidance, read-only preservation, API schema permissions, upgrade/copy
finalization, YAML validation, HTTP conversion and Docker HostConfig serialization.
Existing port preflight tests are included because hardware placement affects
their target-host context.

Release the compatible orchestration engine and node agent **before exposing the
new UI**, and update the bundled Compose client and server dependency pins in the
same release preparation. Check target-host inventory after the agent upgrade.
Old agents do not publish this inventory and cannot be treated as ready.

Before calling a deployment accepted, verify a saved/reopened/upgraded service's
actual Docker inspect values and run a short device enumeration or workload smoke
on each supported real hardware family. Fixture success and cross-compilation
are not CUDA/ROCm/media runtime acceptance. No third-party example image is
implicitly authorized for execution by these tests.

References:

- [Docker run options](https://docs.docker.com/reference/cli/docker/container/run/)
- [Docker Compose GPU reservations](https://docs.docker.com/compose/how-tos/gpu-support/)
- [NVIDIA container driver capabilities](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/docker-specialized.html)
- [AMD ROCm containers](https://rocm.docs.amd.com/projects/install-on-linux/en/docs-7.2.4/how-to/docker.html)
