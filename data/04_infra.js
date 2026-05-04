// ================================================================
// MODULE 4 — CLOUD / K8S
// ================================================================
export default {
  id: "infra", title: "Cloud & Kubernetes", color: "#952020",
  tagClass: "tag-infra", icon: "☁",
  desc: "Containerise your Spring Boot app, deploy to Kubernetes, configure health probes correctly, write Helm charts. This is how Backbase upgrades and deployments actually work.",
  weeks: [

  {
    id: "infra-w9", num: "Week 9", module: "infra",
    title: "Docker & Containerisation",
    subtitle: "Write a production Dockerfile, understand layers, avoid the JVM memory trap",
    hours: 11, tagClasses: ["tag-infra","tag-time"], tagLabels: ["Cloud/K8s","~11 hours"],
    ddia: null,
    objectives: [
      "Explain how Docker image layers work and why order determines cache efficiency",
      "Write a multi-stage production Dockerfile using Spring Boot's layertools",
      "Configure correct JVM memory flags for containerised deployment",
      "Build a Docker Compose stack (app + Postgres + Redis) with proper health checks",
      "Understand the JVM + container memory limit interaction that causes OOMKill"
    ],
    diagram: { type: "docker-layers", caption: "Docker image layers — build cache and change frequency", intro: "Docker builds images as a stack of layers, and layers are cached. If a layer hasn't changed since the last build, Docker reuses it from cache — turning a five-minute rebuild into a ten-second one. The trap: if you COPY your fat jar in one instruction, changing any source file invalidates the entire layer including all 100MB of Maven dependencies. Understanding layer ordering lets you ensure that only your 200KB application layer rebuilds on every commit." },
    labs: [
      {
        num: 1, title: "Write your own production Dockerfile",
        goal: "Start with a naive Dockerfile, measure its problems, then improve it step by step. The complete solution is hidden — try to reach it yourself using the exploration steps and the docs.",
        setup: {
          desc: "Use the banking-app from Week 3. Package it as a fat jar — this is the jar file your Dockerfile will use.",
          steps: [
            {
              text: "From the banking-app project root:",
              code: "mvn clean package -DskipTests",
              lang: "bash"
            }
          ]
        },
        explore: [
          {
            text: "Write your first attempt — a naive Dockerfile that just copies the fat jar and runs it. Build it and measure the image size.",
            code:
`docker build -t my-app:naive .
docker image ls my-app:naive`,
            lang: "bash",
            note: "This is your baseline. A naive Dockerfile typically produces a 300–500MB image. Note the build time — you'll compare this after improvements."
          },
          {
            text: "Change one source file and rebuild. Which layers were rebuilt? How long did it take? This is the layer cache problem that multi-stage builds solve.",
            note: "With a naive COPY target/*.jar approach, changing any source file rebuilds the entire layer including all 100MB of Maven dependencies. The goal is to make code changes only rebuild the tiny 'application classes' layer."
          },
          {
            text: "Research Spring Boot layertools. Run this to see how Spring Boot splits your fat jar into layers:",
            code: "java -Djarmode=layertools -jar target/myapp.jar list",
            lang: "bash",
            note: "You should see: dependencies, spring-boot-loader, snapshot-dependencies, application. 'dependencies' changes only when pom.xml changes. 'application' changes on every build. This informs your COPY instruction order."
          },
          {
            text: "Research the JVM container memory problem. What happens when -Xmx is not set and your JVM runs in a 512MB container on a 32GB host? Which JVM flag makes the heap respect the container limit? Why should you not set it to 100%?",
            note: "The JVM heap is not the only memory the JVM uses. Metaspace (~100MB), thread stacks (~1MB × N threads), and Netty direct buffers also consume memory. Setting MaxRAMPercentage=100 leaves nothing for these — causing OOMKill."
          },
          {
            text: "Now write an improved multi-stage Dockerfile using what you learned in steps 2–4. Use eclipse-temurin:21-jre-alpine as the production base, copy layers in the correct order, and add the right JVM flags."
          }
        ],
        hints: [
          { label: "Multi-stage structure and JVM flags", body: "Stage 1 (builder): FROM eclipse-temurin:21-jdk-alpine AS builder — copy the fat jar and run layertools extract. Stage 2 (runtime): FROM eclipse-temurin:21-jre-alpine — add a non-root user, copy layers in order (dependencies → spring-boot-loader → snapshot-dependencies → application). ENTRYPOINT: java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+UseZGC org.springframework.boot.loader.JarLauncher. The 75% leaves 25% for Metaspace, thread stacks, and direct buffers." }
        ],
        solution: {
          lang: "dockerfile",
          content:
`# Stage 1: extract layers from the fat jar
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /application
COPY target/myapp.jar application.jar
RUN java -Djarmode=layertools -jar application.jar extract

# Stage 2: production runtime image
FROM eclipse-temurin:21-jre-alpine
WORKDIR /application

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy layers: least-changed first (cache-optimal)
COPY --from=builder /application/dependencies/ ./
COPY --from=builder /application/spring-boot-loader/ ./
COPY --from=builder /application/snapshot-dependencies/ ./
COPY --from=builder /application/application/ ./

ENTRYPOINT ["java", \\
  "-XX:+UseContainerSupport", \\
  "-XX:MaxRAMPercentage=75.0", \\
  "-XX:+UseZGC", \\
  "-Djava.security.egd=file:/dev/./urandom", \\
  "org.springframework.boot.loader.JarLauncher"]`
        }
      },
      {
        num: 2, title: "Docker Compose local stack with health checks",
        goal: "Build a complete local stack (app + Postgres + Redis) without the solution first. Deliberately hit the startup race condition, observe it, then fix it with health checks.",
        setup: {
          desc: "Use the Docker image you built in Lab 1 (my-banking-app:latest). The docker-compose.yml will orchestrate that image alongside Postgres and Redis.",
          steps: [{
            text: "Make sure you have the image built from Lab 1:",
            code: "docker images | grep my-banking-app",
            lang: "bash"
          }]
        },
        explore: [
          {
            text: "Write a docker-compose.yml with your app (image: my-banking-app:latest), Postgres, and Redis. Start it — what race condition appears when all three start simultaneously?",
            note: "Your app will try to connect to Postgres before Postgres is ready to accept connections. Spring Boot will fail with 'Connection refused' and exit. Without restart policies or health checks, this is unrecoverable."
          },
          {
            text: "Research Docker Compose healthcheck and depends_on with condition: service_healthy. How do you write a health check for Postgres? For Redis?",
            note: "Postgres: test: ['CMD-SHELL', 'pg_isready -U youruser -d yourdb']. Redis: test: ['CMD', 'redis-cli', 'ping']. Then in your app service: depends_on: postgres: condition: service_healthy."
          },
          {
            text: "Add health checks and restart the stack. Confirm the race condition is gone. How long does it take from 'docker compose up' to the app accepting requests?"
          }
        ],
        hints: [],
        solution: {
          lang: "yaml",
          content:
`version: '3.9'
services:
  app:
    build: .
    ports: ["8080:8080"]
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/bankdb
      SPRING_DATASOURCE_USERNAME: bank
      SPRING_DATASOURCE_PASSWORD: secret
      SPRING_DATA_REDIS_HOST: redis
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: bankdb
      POSTGRES_USER: bank
      POSTGRES_PASSWORD: secret
    volumes: [postgres-data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bank -d bankdb"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      retries: 5

volumes:
  postgres-data:`
        }
      }
    ],
    refs: [
      { type: "Docker docs", name: "Dockerfile Best Practices", url: "https://docs.docker.com/develop/develop-images/dockerfile_best-practices/", desc: "Layer caching, multi-stage builds, minimising image size." },
      { type: "Spring docs", name: "Container Images", url: "https://docs.spring.io/spring-boot/docs/current/reference/html/container-images.html", desc: "Spring Boot's layertools and Buildpacks for efficient images." }
    ],
    checklist: [
      "Wrote a multi-stage Dockerfile from scratch — checked solution only after attempt",
      "Measured image size improvement: naive vs optimised",
      "Confirmed layer cache hit when changing only application code",
      "Configured JVM memory flags and verified heap size inside container",
      "Built Docker Compose stack — reproduced and fixed the startup race condition"
    ]
  },

  {
    id: "infra-w10", num: "Week 10", module: "infra",
    title: "Kubernetes Fundamentals",
    subtitle: "Pods, Deployments, Services, kubectl, and health probes — the foundation before any K8s tuning",
    hours: 10, tagClasses: ["tag-infra","tag-time"], tagLabels: ["Cloud/K8s","~10 hours"],
    ddia: null,
    objectives: [
      "Explain what Kubernetes solves that Docker Compose cannot",
      "Describe the purpose of each control plane component: API Server, etcd, Scheduler, Controller Manager",
      "Identify the core K8s workload objects: Pod, ReplicaSet, Deployment — and how they relate",
      "Use kubectl to deploy, inspect, scale, update, and delete workloads",
      "Write a Deployment YAML with labels, environment variables, and resource requests",
      "Expose a Deployment with a ClusterIP Service and access it via port-forwarding",
      "Configure all three probe types (startup, readiness, liveness) correctly for a Spring Boot app",
      "Reproduce the cascading-restart failure caused by a misconfigured liveness probe"
    ],
    diagram: { type: "k8s-arch", caption: "Kubernetes architecture — control plane + worker nodes", intro: "Before deploying anything, you need a mental model of the cluster itself. Kubernetes is split into a control plane (the brain — decides what should run) and worker nodes (the muscle — actually run it). Every kubectl command you issue goes to the API Server on the control plane. The rest of the system responds by reconciling real cluster state to match what you declared. This declarative model is the fundamental difference from Docker Compose." },
    setup: {
      desc: "All K8s labs in Weeks 10–13 run on minikube — a single-node Kubernetes cluster on your laptop. Install the tools below once, then you are set for all four weeks.",
      steps: [
        {
          text: "Install minikube. Requires Docker Desktop to be running as the container driver.",
          os_tabs: [
            { os: "macOS", lang: "bash", code: "brew install minikube" },
            { os: "Linux", lang: "bash", code:
`curl -Lo minikube https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
chmod +x minikube && sudo mv minikube /usr/local/bin/` },
            { os: "Windows", lang: "bash", code:
`# PowerShell (run as Administrator)
winget install minikube
# Or: choco install minikube` }
          ]
        },
        {
          text: "Install kubectl (the K8s CLI).",
          os_tabs: [
            { os: "macOS", lang: "bash", code: "brew install kubectl" },
            { os: "Linux", lang: "bash", code: "sudo apt-get install -y kubectl" },
            { os: "Windows", lang: "bash", code: "winget install Kubernetes.kubectl" }
          ]
        },
        {
          text: "Install Apache Bench — used in Week 11 for HPA load generation.",
          os_tabs: [
            { os: "macOS", lang: "bash", code:
`# Check if already available (macOS ships it with Apache):
which ab || brew install httpd` },
            { os: "Linux", lang: "bash", code: "sudo apt-get install -y apache2-utils" },
            { os: "Windows", lang: "bash", code:
`# ab is not available natively on Windows.
# Install hey (a modern alternative) instead:
winget install hey
# Then replace all 'ab -n X -c Y URL' commands with:
# hey -n X -c Y URL` }
          ]
        },
        {
          text: "Start minikube and verify the cluster is up:",
          code:
`minikube start --memory=4096 --cpus=4
kubectl cluster-info
kubectl get nodes
# Expected: one node in Ready state`,
          lang: "bash"
        },
        {
          text: "Point Docker to minikube's internal registry so images built locally are visible inside the cluster:",
          os_tabs: [
            { os: "macOS / Linux", lang: "bash", code:
`eval $(minikube docker-env)
# Build your app image (from the Week 9 Dockerfile)
docker build -t my-banking-app:v1 .
docker images | grep my-banking-app` },
            { os: "Windows (PowerShell)", lang: "bash", code:
`& minikube -p minikube docker-env | Invoke-Expression
docker build -t my-banking-app:v1 .
docker images | Select-String my-banking-app` }
          ]
        }
      ]
    },
    labs: [
      {
        num: 1, title: "Your first Deployment — Pods, ReplicaSets, and self-healing",
        goal: "Write a minimal Deployment YAML from scratch and apply it. Observe what K8s creates behind the scenes, then experience the self-healing behaviour that makes K8s different from Docker.",
        explore: [
          {
            text: "Before writing YAML, answer these three questions by reading the K8s docs. This is important — the answers shape everything you do this week. (1) What is a Pod? Why does K8s use Pods instead of just containers? (2) What is a ReplicaSet? Why does K8s have both Deployments and ReplicaSets? (3) What does 'declarative' mean in K8s — how is 'kubectl apply' different from 'docker run'?",
            note: "K8s docs: https://kubernetes.io/docs/concepts/workloads/pods/ and https://kubernetes.io/docs/concepts/workloads/controllers/deployment/ — 15 minutes of reading before starting the lab."
          },
          {
            text: "Write a minimal Deployment YAML. Use imagePullPolicy: Never (because the image is local to minikube). Start with these required fields only — do not add probes or resources yet.",
            code:
`# Save as deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: banking-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: banking-app
  template:
    metadata:
      labels:
        app: banking-app
    spec:
      containers:
      - name: banking-app
        image: my-banking-app:v1
        imagePullPolicy: Never
        ports:
        - containerPort: 8080`,
            lang: "yaml"
          },
          {
            text: "Apply the Deployment and watch pods start.",
            code:
`kubectl apply -f deployment.yaml
# Watch pods appear (Ctrl+C to stop)
kubectl get pods -w`,
            lang: "bash",
            note: "The pod goes through: Pending (scheduled to a node) → ContainerCreating (image being pulled, container starting) → Running. If it stays in Pending, check kubectl describe pod <pod-name> for the reason."
          },
          {
            text: "Look at what K8s created behind the scenes. One Deployment creates a ReplicaSet which creates Pods.",
            code:
`kubectl get deployment banking-app
kubectl get replicaset
kubectl describe deployment banking-app
# Look at Events at the bottom — K8s created a ReplicaSet, which created Pods`,
            lang: "bash",
            note: "The Deployment manages the ReplicaSet. The ReplicaSet manages Pods. You only interact with the Deployment — the rest is automatic."
          },
          {
            text: "Experience self-healing: delete the pod manually and watch K8s restart it.",
            code:
`# Get the pod name
kubectl get pods
# Delete it
kubectl delete pod <pod-name>
# Watch immediately — K8s starts a replacement
kubectl get pods -w`,
            lang: "bash",
            note: "This is the core value of K8s: you declared 'I want 1 replica running' and K8s continuously enforces that. When a pod is deleted, the ReplicaSet controller notices the actual count (0) doesn't match desired count (1) and creates a new pod."
          },
          {
            text: "Scale up and observe. Then scale back down.",
            code:
`kubectl scale deployment banking-app --replicas=3
kubectl get pods -w
kubectl scale deployment banking-app --replicas=1`,
            lang: "bash"
          }
        ],
        hints: [
          { label: "Pod stuck in CrashLoopBackOff", body: "kubectl logs <pod-name> — check the last 20 lines. Most common cause: the container starts but the app fails (missing environment variables for DB connection, wrong classpath). For a Spring Boot app that can't reach a DB, it may crash on startup. Quick fix for this lab: add spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration to skip DB autoconfiguration." }
        ],
        solution: null
      },
      {
        num: 2, title: "Services — give your app a stable network identity",
        goal: "A Pod's IP changes every restart. A Service gives a stable IP and DNS name within the cluster. Write a ClusterIP Service, access it via port-forwarding, and understand how label selectors bind Services to Pods.",
        explore: [
          {
            text: "Write a Service YAML. The selector must match the labels on your Pods (app: banking-app from your Deployment).",
            code:
`# Save as service.yaml
apiVersion: v1
kind: Service
metadata:
  name: banking-app-svc
spec:
  selector:
    app: banking-app
  ports:
  - port: 80
    targetPort: 8080`,
            lang: "yaml"
          },
          {
            text: "Apply the Service and verify it found your Pods by checking the Endpoints.",
            code:
`kubectl apply -f service.yaml
kubectl get service banking-app-svc
# Endpoints lists the Pod IPs behind this Service
kubectl get endpoints banking-app-svc`,
            lang: "bash",
            note: "If Endpoints shows <none>, the Service selector doesn't match any Pod labels. Compare 'kubectl get pods --show-labels' with your service.yaml selector."
          },
          {
            text: "Use port-forwarding to access the Service from your laptop.",
            code:
`# Forward local port 8080 to Service port 80
kubectl port-forward service/banking-app-svc 8080:80 &
# Test it
curl http://localhost:8080/actuator/health`,
            lang: "bash"
          },
          {
            text: "Understand the three Service types. For each, answer: when would you use it in a banking platform? (a) ClusterIP — internal only (default). (b) NodePort — exposes a port on every node's IP. (c) LoadBalancer — provisions a cloud load balancer (AWS ELB, GCP LB). In minikube, run: minikube tunnel to simulate a LoadBalancer.",
            note: "In production Backbase: ClusterIP is used between microservices (internal). LoadBalancer or Ingress is used for external traffic. NodePort is rarely used directly — it's the underlying mechanism for LoadBalancer."
          }
        ],
        hints: [],
        solution: null
      },
      {
        num: 3, title: "Health probes — startup, readiness, liveness",
        goal: "This lab is the prerequisite for Week 10A. Configure all three probe types correctly, then deliberately misconfigure liveness to check the database. Watch the cascading-restart failure that brings down your entire app when the DB is unreachable.",
        explore: [
          {
            text: "Add a startup probe to your Deployment. Spring Boot can take 30–60 seconds to start (loading context, running Liquibase, establishing pool). A startup probe gives it time without triggering liveness failures during startup.",
            code:
`# Add this to your container spec in deployment.yaml:
startupProbe:
  httpGet:
    path: /actuator/health
    port: 8080
  failureThreshold: 30   # 30 × 10s = 5 minutes max startup time
  periodSeconds: 10`,
            lang: "yaml",
            note: "The startup probe disables the liveness probe until the first success. This prevents K8s from killing the container because it's 'not alive' during a slow first startup."
          },
          {
            text: "Add a readiness probe. Readiness controls whether the pod receives traffic — NOT whether it restarts. A failing readiness probe removes the pod from Service endpoints (no traffic), but K8s does not restart it.",
            code:
`readinessProbe:
  httpGet:
    path: /actuator/health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5`,
            lang: "yaml",
            note: "Apply the updated deployment.yaml, then stop your Postgres container: docker stop pg-lab. Watch the pod status. It should go NotReady but NOT restart — the app is still running, it's just not healthy enough to receive traffic."
          },
          {
            text: "Add a liveness probe. Liveness should only verify that the JVM process itself is responsive — NOT that DB is reachable. Spring Boot Actuator provides a dedicated /actuator/health/liveness endpoint for this purpose.",
            code:
`livenessProbe:
  httpGet:
    path: /actuator/health/liveness
    port: 8080
  initialDelaySeconds: 60
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3`,
            lang: "yaml",
            note: "Spring Boot Actuator separates liveness (/actuator/health/liveness) from readiness (/actuator/health/readiness) for exactly this reason. Add to application.yml: management.health.livenessstate.enabled: true and management.health.readinessstate.enabled: true"
          },
          {
            text: "Reproduce the cascading restart failure. Change the liveness probe path to /actuator/health (which includes DB health). Stop your Postgres container. Watch what happens.",
            code:
`# Change liveness probe path from /actuator/health/liveness to /actuator/health
# Apply the broken config:
kubectl apply -f deployment.yaml

# Now stop Postgres:
docker stop pg-lab

# Watch the chaos:
kubectl get pods -w

# Describe the pod — find the liveness probe failure in Events:
kubectl describe pod <pod-name>`,
            lang: "bash",
            note: "DB goes down → liveness probe calls /actuator/health → DB health check fails → probe returns 500 → K8s restarts the pod → new pod starts, connects to DB... wait, DB is still down → liveness fails again → restart again. All replicas enter this cycle. Even when the DB recovers, newly started pods may take time to reconnect, extending the outage. This is a real production incident pattern."
          }
        ],
        hints: [
          { label: "Full Deployment YAML with all three probes", body: "startupProbe + readinessProbe + livenessProbe together. The startup probe fires first: once it passes, liveness and readiness take over. If startup times out (failureThreshold × periodSeconds), K8s restarts the container. After startup passes, liveness runs every periodSeconds — three consecutive failures restart the container. Readiness also runs every periodSeconds — failure removes from Service endpoints but does not restart." }
        ],
        solution: {
          lang: "yaml",
          content:
`apiVersion: apps/v1
kind: Deployment
metadata:
  name: banking-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: banking-app
  template:
    metadata:
      labels:
        app: banking-app
    spec:
      containers:
      - name: banking-app
        image: my-banking-app:v1
        imagePullPolicy: Never
        ports:
        - containerPort: 8080
        env:
        - name: SPRING_DATASOURCE_URL
          value: jdbc:postgresql://postgres-svc:5432/bankdb
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        startupProbe:
          httpGet:
            path: /actuator/health
            port: 8080
          failureThreshold: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /actuator/health/liveness
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3`
        }
      }
    ],
    refs: [
      { type: "K8s docs", name: "Deployments", url: "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/", desc: "Official guide with rollout strategies, scaling, and rollback. Read Updating a Deployment and Rolling Back a Deployment." },
      { type: "K8s docs", name: "Configure Liveness, Readiness and Startup Probes", url: "https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/", desc: "All probe types with examples. The HTTP probe section is most relevant for Spring Boot services." },
      { type: "Spring docs", name: "Kubernetes Probes with Actuator", url: "https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html#actuator.endpoints.kubernetes-probes", desc: "How Spring Boot separates liveness and readiness state internally. Required reading before configuring probes." },
      { type: "minikube docs", name: "Getting Started", url: "https://minikube.sigs.k8s.io/docs/start/", desc: "Installation and common minikube commands." }
    ],
    checklist: [
      "Explained the difference between Pod, ReplicaSet, and Deployment from memory",
      "Applied a Deployment YAML and found the ReplicaSet it created",
      "Deleted a pod and confirmed K8s immediately created a replacement",
      "Created a Service with the correct selector and verified Endpoints listed the Pod IPs",
      "Configured all three probe types in a Deployment YAML correctly",
      "Reproduced the liveness+DB cascading restart failure and explained why it happens"
    ]
  },

  {
    id: "infra-w11", num: "Week 11", module: "infra",
    title: "K8s Resources, QoS & Autoscaling",
    subtitle: "Size services correctly, diagnose OOMKill, and configure HPA — with the probe foundation from Week 10",
    hours: 10, tagClasses: ["tag-infra","tag-time"], tagLabels: ["Cloud/K8s","~10 hours"],
    ddia: null,
    objectives: [
      "Diagnose OOMKill from incorrect memory limits and calculate the correct JVM memory budget",
      "Understand requests vs limits and why Guaranteed QoS matters in production banking",
      "Configure HPA and observe pod autoscaling under load",
      "Understand why CPU-based HPA is wrong for I/O-bound services"
    ],
    diagram: { type: "k8s-probes", caption: "K8s probe types — the foundation configured in Week 10 that directly affects resource behaviour", intro: "The three probe types from Week 10 interact directly with resource configuration and autoscaling. A liveness probe with a timeout shorter than a GC pause restarts healthy pods. A slow readiness probe delays when newly scaled pods start serving traffic. The diagram below is a reference — make sure you understand each probe's failure action before continuing with resource sizing and HPA." },
    setup: {
      desc: "Start minikube with the metrics-server addon (required for HPA), then build two versions of your app image to test rolling upgrades.",
      steps: [
        {
          code:
`minikube start --memory=4096 --cpus=4
minikube addons enable metrics-server
# Verify metrics-server is ready (takes ~60s)
kubectl top nodes`,
          lang: "bash"
        },
        {
          text: "Build v1 and v2 images — use your Dockerfile from Week 9:",
          code:
`eval $(minikube docker-env)

# Build v1
docker build -t my-banking-app:v1 .

# Make a trivial change (e.g. edit a log message), then build v2
docker build -t my-banking-app:v2 .

docker images | grep my-banking-app`,
          lang: "bash"
        }
      ]
    },
    labs: [
      {
        num: 1, title: "Resource sizing — OOMKill, requests vs limits, QoS classes",
        goal: "Memory misconfiguration is one of the most common platform team problems. Pods restart mysteriously. Logs show nothing. The cause is OOMKill — the kernel silently kills the process when it exceeds its memory limit. Learn to reproduce it, diagnose it, and set limits correctly.",
        explore: [
          {
            text: "Use the Deployment YAML from Week 10 Lab 3. Edit the resources section to set an intentionally undersized memory limit. Apply it and watch what happens.",
            code:
`# Edit the resources block in your deployment.yaml:
resources:
  requests:
    memory: "128Mi"
    cpu: "250m"
  limits:
    memory: "128Mi"   # Too small for JVM — will cause OOMKill
    cpu: "500m"

# Apply it:
kubectl apply -f deployment.yaml`,
            lang: "yaml",
            note: "The pod will start, then get killed shortly after with exit code 137. That code means OOMKill — the Linux kernel killed the process, not K8s itself."
          },
          {
            text: "Find the OOMKill evidence in the pod description.",
            code:
`kubectl describe pod <pod-name>

# Look for these lines:
#   Last State: Terminated
#     Reason: OOMKilled
#     Exit Code: 137
#
# Also check events at the bottom of the output`,
            lang: "bash",
            note: "OOMKill is silent in application logs — the process never gets a chance to log anything. kubectl describe is the only place to find it."
          },
          {
            text: "Calculate the correct memory limit for your app. The JVM heap is not the only consumer of memory.",
            note: "With MaxRAMPercentage=75 and a 512 MB limit, the heap alone is 384 MB — leaving only 128 MB for Metaspace, threads, and buffers. That is too tight for most Spring Boot services. A safer starting point: 768 MB limit. Verify actual usage with: kubectl top pod"
          },
          {
            text: "Understand QoS classes. Set requests = limits and observe the QoS class assigned.",
            code:
`kubectl get pod <pod-name> -o jsonpath='{.status.qosClass}'
# Should print: Guaranteed

# If requests < limits:
# QoS class = Burstable
# K8s evicts Burstable pods first under node memory pressure`,
            lang: "bash",
            note: "For production: always Guaranteed (requests = limits). K8s evicts BestEffort first, then Burstable, then Guaranteed."
          },
          {
            text: "Connect GC config to memory limits. With a 512 MB limit and MaxRAMPercentage=75, a Full GC pause freezes all JVM threads including the HTTP server. If your liveness probe timeoutSeconds is less than the Full GC duration, K8s kills a healthy pod. What is the fix?",
            note: "Two options: (1) Set liveness probe timeoutSeconds to at least 2× your worst-case GC pause duration — check your GC logs from Week 5. (2) Switch to ZGC which has sub-millisecond pauses and never freezes the HTTP server long enough to fail a probe."
          }
        ],
        hints: [
          { label: "Memory limit formula for Spring Boot services", body: "Start with: limit = (desired heap / 0.75). For 512 MB heap: limit = 682 MB, round to 768 MB. Then verify with kubectl top pod under load — if actual usage approaches the limit, increase it. Never set limits below 384 MB for a Spring Boot service with Hibernate and connection pooling." }
        ],
        solution: null
      },
      {
        num: 2, title: "HPA — horizontal pod autoscaling",
        goal: "The platform team configures HPA for services that need to scale under load. Understand how it works, what metric to use, and the JVM-specific traps that make naive CPU-based HPA dangerous.",
        explore: [
          {
            text: "Create an HPA targeting CPU utilisation at 50%. Expose the service externally via minikube tunnel, then generate load.",
            code:
`# Create HPA
kubectl autoscale deployment banking-app \
  --cpu-percent=50 \
  --min=2 \
  --max=8

# Watch HPA in real time (leave this running)
kubectl get hpa -w`,
            lang: "bash",
            note: "In a separate terminal, run the load generator below. Watch TARGETS column — when current% exceeds 50%, HPA adds pods.",
            os_tabs: [
              { os: "macOS / Linux", lang: "bash", code:
`# Open a tunnel to the service (separate terminal, leave running):
kubectl port-forward service/banking-app-svc 8080:80 &

# Generate load:
ab -n 10000 -c 50 http://localhost:8080/actuator/health` },
              { os: "Windows (PowerShell)", lang: "bash", code:
`# Open a tunnel to the service (separate terminal, leave running):
kubectl port-forward service/banking-app-svc 8080:80

# Generate load with hey (install: winget install hey):
hey -n 10000 -c 50 http://localhost:8080/actuator/health` }
            ]
          },
          {
            text: "Observe scale-down behaviour. After stopping the load, how long does it take for pods to scale back down? Why the delay?",
            code:
`# Stop the load test (Ctrl+C), then watch
kubectl get hpa -w`,
            lang: "bash",
            note: "Default scale-down stabilisation window is 300 seconds (5 minutes). This prevents thrashing — if the load was a short spike, you do not want to scale down and then immediately scale back up."
          },
          {
            text: "Understand why CPU is often the wrong metric for database-heavy services. A service blocked waiting on DB connections or Kafka uses almost zero CPU but is completely saturated. Research KEDA (Kubernetes Event-driven Autoscaling) — it can scale on custom metrics like hikaricp_connections_pending or kafka_consumer_lag.",
            note: "For a banking payment service that is I/O bound: better HPA targets are HTTP request queue depth, DB connection pool pending count, or Kafka consumer lag. Your job as a backend engineer: expose the right Micrometer metrics so the platform team can configure scaling rules."
          },
          {
            text: "Connect HPA to readiness probes. A new pod scaled by HPA is not ready to serve traffic until its readiness probe passes. Confirm this: during a scale-up event, check whether the new pod receives requests before it is Ready.",
            code:
`kubectl get endpoints banking-app-svc -w`,
            lang: "bash",
            note: "The endpoint only appears in the Service once the readiness probe passes. A slow readiness probe delays when scaled pods can help — which can cause HPA to scale even more pods while waiting."
          }
        ],
        hints: [
          { label: "HPA with JVM warm-up", body: "JVM services have a warm-up period: JIT compilation runs, caches fill, connection pools establish. For the first 30–60 seconds a new pod handles less load than a warmed pod. Mitigation: configure a preStopHook sleep (3–5s) to let connections drain on scale-down, and tune minReplicas to keep warmed pods available." }
        ],
        solution: null
      }
    ],
    refs: [
      { type: "K8s docs", name: "Resource Management for Pods", url: "https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/", desc: "Official guide on requests, limits, and QoS classes. Read the QoS section carefully." },
      { type: "K8s docs", name: "Horizontal Pod Autoscaling", url: "https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/", desc: "HPA configuration, metrics, and scaling behaviour." },
      { type: "KEDA", name: "KEDA — Event-driven Autoscaling", url: "https://keda.sh/docs/latest/concepts/", desc: "Scale on custom metrics like Kafka lag or HTTP queue depth. The right tool for I/O-bound banking services." }
    ],
    checklist: [
      "Reproduced OOMKill and found exit code 137 in kubectl describe pod",
      "Calculated correct memory limit using heap + Metaspace + threads + buffers formula",
      "Understood why Guaranteed QoS (requests = limits) is correct for production services",
      "Explained the GC pause + liveness probe interaction and how to fix it",
      "Configured HPA and watched pods scale up under load",
      "Explained why CPU is wrong for DB-bound services and what KEDA solves"
    ]
  },

  {
    id: "infra-w12", num: "Week 12", module: "infra",
    title: "Deployment Strategies & DB Migrations",
    subtitle: "Rolling, blue-green, canary — and which database migration types each strategy supports safely",
    hours: 6, tagClasses: ["tag-infra","tag-time"], tagLabels: ["Cloud/K8s","~6 hours"],
    ddia: null,
    objectives: [
      "Explain rolling, blue-green, and canary deployment strategies and their tradeoffs",
      "Understand why rolling deployments constrain which DB migrations are safe to run",
      "Apply the expand-contract pattern to safely rename a column in a live system",
      "Classify migration types (add column, rename, drop) as rolling-safe or blue-green-required",
      "Simulate blue-green deployment using slot labels and a Service selector switch"
    ],
    diagram: null,
    labs: [
      {
        num: 1, title: "Deployment strategies and DB migrations",
        goal: "Three deployment strategies exist. Your choice of strategy constrains what DB migrations you can run safely. Understanding this is critical for the platform team — a wrong choice causes production incidents.",
        explore: [
          {
            text: "Deploy V1 first (use the Deployment YAML from Week 10 Lab 3 with image: my-banking-app:v1), then trigger a rolling update to V2 and watch the overlap window.",
            code:
`# Apply with v1 image
kubectl apply -f deployment.yaml  # image: my-banking-app:v1
kubectl rollout status deployment/banking-app

# Update to v2 — K8s begins rolling update
kubectl set image deployment/banking-app \
  banking-app=my-banking-app:v2

# Watch both v1 and v2 pods running simultaneously
kubectl get pods -w`,
            lang: "bash",
            note: "During the overlap window, some requests go to V1 and some to V2. They share the same database. Any migration that V2 runs on startup must not break V1's SQL queries."
          },
          {
            text: "Research the expand-contract pattern (also called parallel change). This is the only safe way to rename a column or change a type in a system using rolling deployments. Map out the three phases for renaming a column from 'txn_status' to 'status'.",
            note: "The three phases ensure that at no point does running code reference a column that does not exist — even during a rolling deploy with V1 and V2 simultaneously live. Phase 1 (expand): add new column 'status', V2 writes to both. Phase 2 (contract — once V1 is gone): migrate data, drop old column 'txn_status'."
          },
          {
            text: "Simulate blue-green by creating two Deployments with a slot label. The Service selector controls which one receives traffic.",
            code:
`# deployment-blue.yaml: copy deployment.yaml from Week 10
# Add slot: blue to spec.template.metadata.labels
# Set image to my-banking-app:v1

# deployment-green.yaml: same, but slot: green, image: v2

kubectl apply -f deployment-blue.yaml
kubectl apply -f deployment-green.yaml

# Point Service at blue
kubectl patch service banking-app-svc \
  -p '{"spec":{"selector":{"app":"banking-app","slot":"blue"}}}'

kubectl get endpoints banking-app-svc

# Switch to green — instant, atomic, no overlap
kubectl patch service banking-app-svc \
  -p '{"spec":{"selector":{"app":"banking-app","slot":"green"}}}'`,
            lang: "bash",
            note: "Blue-green has no V1/V2 overlap. You can run destructive migrations safely: run the migration while blue is serving traffic, then switch to green. Rollback = patch selector back to blue. Downside: double infrastructure cost during the transition."
          },
          {
            text: "For each of the following migration types, decide: rolling or blue-green? Explain your reasoning for each. (a) Add a nullable column. (b) Rename a column. (c) Change a column from VARCHAR to TEXT. (d) Add an index (CREATE INDEX CONCURRENTLY). (e) Drop a table.",
            note: "Answers: (a) Rolling — additive, V1 ignores the new column. (b) Blue-green or expand-contract — V1 breaks if it queries the old name after rename. (c) Depends on DB — in Postgres, VARCHAR to TEXT is a type-compatible change and may be safe rolling. (d) Rolling — CONCURRENTLY does not lock the table. (e) Blue-green only — destructive, V1 will break immediately."
          }
        ],
        hints: [
          { label: "Liquibase and rolling deploys", body: "Liquibase acquires a lock in the DATABASECHANGELOCK table before running migrations. In a rolling deploy, multiple pods start simultaneously and all try to run Liquibase. Only one acquires the lock and runs the migration. Others wait, then see the migration already applied and skip it. This is safe — but it means the first pod to start runs migrations before others are ready, so the migration is live before rollout completes. Design migrations accordingly." }
        ],
        solution: null
      }
    ],
    refs: [
      { type: "Martin Fowler", name: "Parallel Change (expand-contract)", url: "https://martinfowler.com/bliki/ParallelChange.html", desc: "The canonical reference for safe schema changes in a live rolling-deploy system." },
      { type: "Martin Fowler", name: "BlueGreenDeployment", url: "https://martinfowler.com/bliki/BlueGreenDeployment.html", desc: "Original article defining blue-green. Short and precise." }
    ],
    checklist: [
      "Observed the rolling deployment overlap window with kubectl get pods -w",
      "Applied expand-contract pattern to a column rename scenario",
      "Simulated blue-green with slot labels and an atomic Service selector switch",
      "Correctly classified 5 migration types as rolling-safe or blue-green-required"
    ]
  },

  {
    id: "infra-w13", num: "Week 13", module: "infra",
    optional: true,
    title: "GitOps, CI/CD Concepts & GC in Production",
    subtitle: "Understand the deployment pipeline your bank uses — Jenkins, ArgoCD, Helm — and how to tune GC for containerised services",
    hours: 6, tagClasses: ["tag-infra","tag-time"], tagLabels: ["Cloud/K8s","~6 hours · Optional"],
    ddia: null,
    objectives: [
      "Trace the full deployment flow from code push to running pod at your bank",
      "Explain why :latest image tags break GitOps and what to use instead",
      "Understand why ArgoCD rollback does not undo Liquibase migrations",
      "Connect GC algorithm choice (ZGC vs G1GC) to Kubernetes probe configuration",
      "Know what JVM flags the platform team sets in Kubernetes env vars"
    ],
    diagram: null,
    labs: [
      {
        num: 1, title: "The GitOps mental model — Jenkins → ArgoCD → Helm",
        goal: "You do not run helm install in production. ArgoCD does. Understanding this mental model changes how you think about deployments — a PR to a values file is a production deployment.",
        optional: true,
        explore: [
          {
            text: "Trace the full deployment pipeline for your bank. Map each step to who owns it.",
            note: "The key insight: you own the code and tests. The pipeline, image registry, and cluster sync are owned by others. Your deployment artifact is a PR to a values file."
          },
          {
            text: "Understand why :latest is dangerous in a GitOps pipeline.",
            note: "If your image is tagged :latest: (1) You lose the ability to trace which code version is running in production. (2) If ArgoCD has auto-sync enabled, every image push triggers a deployment with no visibility into what changed. (3) Rollback means nothing — :latest always points to the newest image. Always tag with commit SHA or semantic version."
          },
          {
            text: "Understand the ArgoCD rollback limitation. ArgoCD can revert a Helm release to a previous values file state (previous image tag). What it cannot do: undo a Liquibase migration that already ran on the new pods.",
            note: "If V2 pods ran a Liquibase migration that added a NOT NULL column with no default, and you rollback to V1 via ArgoCD, V1 code may fail because it does not handle the new column. The safest recovery: fix forward with a V3 hotfix rather than rollback. This is why backward-compatible migrations (expand-contract) are not optional — they are your rollback plan."
          },
          {
            text: "Optional hands-on: if you have access to your bank's ArgoCD (ask your team), navigate to the application for a non-production environment. Find: the Git repo it watches, the values file it uses, the current sync status, and the revision history. Do not change anything — just read.",
            note: "This is optional and depends on access. The goal is connecting the mental model to a real system you will work with."
          }
        ],
        hints: [
          { label: "ArgoCD sync policies", body: "Auto-sync: ArgoCD applies any Git change immediately. Used for dev/staging. Manual sync: a human approves the sync in the ArgoCD UI. Used for production at most banks. Your bank likely has manual sync for production Backbase deployments — a PR to the values file requires approval before ArgoCD applies it." }
        ],
        solution: null
      },
      {
        num: 2, title: "JVM and GC configuration in Kubernetes context",
        goal: "The platform team owns the JVM flags set in K8s environment variables. Understand which flags matter, why they are set the way they are, and how GC choice affects the rest of your K8s config.",
        optional: true,
        explore: [
          {
            text: "Review the standard JVM flags the platform team sets for containerised Spring Boot services and understand each one.",
            code:
`# In K8s Deployment env section:
env:
  - name: JAVA_OPTS
    value: >-
      -XX:+UseContainerSupport
      -XX:MaxRAMPercentage=75.0
      -XX:+UseZGC
      -XX:+ZGenerational
      -Xlog:gc*:file=/var/log/gc.log:time,uptime
      -XX:+HeapDumpOnOutOfMemoryError
      -XX:HeapDumpPath=/var/log/heapdump.hprof
      -Dnetworkaddress.cache.ttl=30`,
            lang: "yaml",
            note: "Each flag: UseContainerSupport = reads cgroup memory limits. MaxRAMPercentage=75 = heap is 75% of container limit. UseZGC + ZGenerational = low-pause GC. Xlog:gc = write GC log to file. HeapDumpOnOutOfMemoryError = auto-capture heap dump on OOM. networkaddress.cache.ttl=30 = prevents stale DNS after rolling deploys."
          },
          {
            text: "Connect GC choice to probe configuration. With G1GC, Full GC can pause for hundreds of milliseconds. With ZGC, pauses are sub-millisecond. How does this change your liveness probe timeoutSeconds?",
            note: "G1GC: set liveness probe timeoutSeconds to at least 2 seconds to survive worst-case Full GC pauses. ZGC: timeoutSeconds of 1 second is sufficient. This is one concrete reason the platform team chooses ZGC for API-facing services — it simplifies probe configuration and eliminates GC-induced probe failures."
          },
          {
            text: "Research Kubernetes vertical pod autoscaling (VPA) as a tool for right-sizing memory and CPU requests over time. How does VPA differ from HPA? When would you use each?",
            note: "HPA: scales out (more pods). VPA: scales up (bigger pods, adjusts requests). VPA is useful for right-sizing during the initial deployment phase — it observes actual usage and recommends or automatically adjusts requests/limits. Most teams use VPA in recommendation mode first, then apply values manually."
          }
        ],
        hints: [],
        solution: null
      }
    ],
    refs: [
      { type: "ArgoCD docs", name: "ArgoCD Introduction", url: "https://argo-cd.readthedocs.io/en/stable/", desc: "Official docs. Read Getting Started and Core Concepts — 30 minutes." },
      { type: "Article", name: "GitOps Principles (Weaveworks)", url: "https://www.weave.works/technologies/gitops/", desc: "Original GitOps definition. Explains why Git is the source of truth." },
      { type: "K8s docs", name: "Vertical Pod Autoscaler", url: "https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler", desc: "VPA for right-sizing resources over time." }
    ],
    checklist: [
      "Can trace the full deployment flow from code push to running pod",
      "Explained why :latest breaks GitOps reproducibility",
      "Understood why ArgoCD rollback does not undo Liquibase migrations — and what this means for your migration strategy",
      "Identified every JVM flag in the standard K8s env block and explained its purpose",
      "Connected GC algorithm choice to liveness probe timeoutSeconds configuration"
    ]
  }

  ] // end infra.weeks
}
