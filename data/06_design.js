// ================================================================
// MODULE 6 — SYSTEM DESIGN
// ================================================================
{
  id: "design", title: "System Design", color: "#42348c",
  tagClass: "tag-design", icon: "📐",
  desc: "Caching, message queues, and CAP theorem. The vocabulary and mental models to reason about architecture decisions — the level expected of a Senior Software Engineer.",
  weeks: [

  {
    id: "design-w13", num: "Week 13", module: "design",
    title: "Caching, Message Queues & CAP Theorem",
    subtitle: "Three concepts you will reference in every architecture discussion",
    hours: 13, tagClasses: ["tag-design","tag-time"], tagLabels: ["System Design","~13 hours"],
    ddia: { chapter: "Chapters 5, 9, 11", note: "Chapter 5 (Replication) for consistency/availability tradeoffs. Chapter 9 (Consistency and Consensus) for CAP theorem. Chapter 11 (Stream Processing) for Kafka, consumer groups, and offset management. Most DDIA-intensive week." },
    objectives: [
      "Implement cache-aside pattern with Redis in Spring Boot",
      "Handle Redis failure gracefully — app must not go down when cache is down",
      "Produce and consume Kafka messages with correct key and partition strategy",
      "Explain consumer group partition assignment and what happens when a consumer fails",
      "Articulate CAP theorem with concrete banking examples for the CP vs AP choice"
    ],
    diagram: { type: "cap", caption: "CAP theorem — the real choice is CP vs AP when partitions occur" },
    labs: [
      {
        num: 1, title: "Redis cache-aside — implement and break it",
        goal: "Implement caching correctly, then deliberately kill Redis and verify your service degrades gracefully rather than crashing.",
        setup: {
          desc: "Start a Redis container and add Spring Cache dependencies.",
          steps: [
            { code: "docker run --name redis-lab -p 6379:6379 -d redis:7-alpine", lang: "bash" },
            {
              text: "Add to pom.xml:",
              code:
`<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-cache</artifactId>
</dependency>`,
              lang: "yaml"
            },
            {
              text: "application.yml:",
              code:
`spring:
  cache:
    type: redis
    redis:
      time-to-live: 30s
  data:
    redis:
      host: localhost
      port: 6379
      timeout: 2000ms`,
              lang: "yaml"
            }
          ]
        },
        explore: [
          {
            text: "Add @Cacheable to an account lookup method. Call it twice and verify the second call hits the cache.",
            reveal: true,
            code:
`@Service
public class AccountService {

    @Cacheable(value = "accounts", key = "#accountId")
    public Account getAccount(Long accountId) {
        log.info("DB hit for account {}", accountId);
        return accountRepo.findById(accountId).orElseThrow();
    }

    @CacheEvict(value = "accounts", key = "#account.id")
    public Account updateBalance(Account account) {
        return accountRepo.save(account);
    }
}`,
            lang: "java",
            note: "Watch the logs — 'DB hit' should only appear on the first call. On the second call, the log line should not appear at all (served from cache)."
          },
          {
            text: "Inspect the cached entry directly in Redis.",
            code:
`redis-cli -h localhost -p 6379
KEYS *
TTL accounts::42`,
            lang: "bash",
            note: "You should see the cache entry with a TTL of 30 seconds."
          },
          {
            text: "Stop Redis and make a request. Does your app crash or degrade gracefully?",
            code: "docker stop redis-lab",
            lang: "bash",
            note: "Default Spring Cache behaviour: if Redis is down, the cache method throws an exception and the request fails. You need to configure it to fall through to the DB instead."
          },
          {
            text: "Research: how do you configure Spring Cache to fall through to the underlying method when Redis is unavailable? What is the tradeoff of this approach?"
          },
          {
            text: "Determine appropriate TTLs: for account balance, for account metadata (name/branch), and for product catalogue. What is the cost of stale data in each case?"
          }
        ],
        hints: [
          { label: "Graceful Redis fallback", body: "Add a CacheErrorHandler bean that logs errors but does not rethrow them: @Override public void handleCacheGetError(RuntimeException e, Cache cache, Object key) { log.warn('Cache read error, falling through to DB: {}', e.getMessage()); }. Register it via @Configuration implementing CachingConfigurerSupport. Now cache failures fall through to the real method silently." }
        ],
        solution: null
      },
      {
        num: 2, title: "Kafka — produce, consume, understand partitions",
        goal: "Set up Kafka and explore partition assignment, message ordering guarantees, and what happens when a consumer goes down — through experimentation, not reading.",
        setup: {
          desc: "Start Kafka in KRaft mode (no ZooKeeper needed).",
          steps: [
            {
              code:
`docker run --name kafka-lab \
  -e KAFKA_CFG_NODE_ID=0 \
  -e KAFKA_CFG_PROCESS_ROLES=controller,broker \
  -e KAFKA_CFG_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093 \
  -e KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP=\
      CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT \
  -e KAFKA_CFG_CONTROLLER_QUORUM_VOTERS=0@localhost:9093 \
  -e KAFKA_CFG_CONTROLLER_LISTENER_NAMES=CONTROLLER \
  -p 9092:9092 \
  -d bitnami/kafka:latest`,
              lang: "bash"
            },
            {
              text: "Add Spring Kafka dependency:",
              code:
`<dependency>
  <groupId>org.springframework.kafka</groupId>
  <artifactId>spring-kafka</artifactId>
</dependency>`,
              lang: "yaml"
            }
          ]
        },
        explore: [
          {
            text: "Create a topic with 3 partitions, write a producer using accountId as the message key, and send 30 messages for 10 different accounts.",
            code:
`# Create topic
docker exec kafka-lab kafka-topics.sh \
  --create --topic transaction-events \
  --partitions 3 --replication-factor 1 \
  --bootstrap-server localhost:9092

# Check which messages went to which partition
docker exec kafka-lab kafka-console-consumer.sh \
  --topic transaction-events \
  --from-beginning \
  --property print.partition=true \
  --bootstrap-server localhost:9092`,
            lang: "bash",
            note: "All messages for the same accountId should land on the same partition. Verify this. Why does using accountId as the key guarantee this?"
          },
          {
            text: "Start one consumer in group 'audit-service'. Confirm it consumes all 3 partitions. Then start a second consumer in the same group and observe partition rebalancing.",
            code:
`# Output columns: TOPIC | PARTITION | CURRENT-OFFSET | LOG-END-OFFSET | LAG
# LAG = messages produced but not yet consumed (0 = consumer is caught up)
docker exec kafka-lab kafka-consumer-groups.sh \
  --describe --group audit-service \
  --bootstrap-server localhost:9092`,
            lang: "bash",
            note: "With 3 partitions and 2 consumers: one consumer gets 2 partitions, the other gets 1. With 3 consumers: 1 each. With 4 consumers: one is idle. This is why concurrency in @KafkaListener should equal the partition count."
          },
          {
            text: "Stop one consumer for 2 minutes. Produce messages during the outage. Restart the consumer. Are the messages there? What does this tell you about Kafka's durability model vs a traditional message queue?"
          }
        ],
        hints: [
          { label: "Key → partition routing", body: "Kafka routes messages using: partition = hash(key) % numPartitions. All events with key = '42' always hash to the same partition. Since Kafka guarantees ordering within a partition (not across partitions), using accountId as key guarantees all events for the same account are processed in order. Without a key: messages are round-robined across partitions — no ordering guarantee." }
        ],
        solution: null
      }
    ],
    refs: [
      { type: "DDIA", name: "Chapter 9 — Consistency and Consensus", url: null, desc: "The definitive treatment of CAP theorem, linearizability, and what consistency actually means." },
      { type: "DDIA", name: "Chapter 11 — Stream Processing", url: null, desc: "Kafka's design philosophy, log vs queue, consumer offsets, exactly-once semantics." },
      { type: "Kafka docs", name: "Kafka Introduction", url: "https://kafka.apache.org/documentation/#gettingStarted", desc: "Topics, partitions, consumer groups, offsets. Read alongside the lab." }
    ],
    checklist: [
      "Implemented cache-aside with Redis and verified cache hits via logs",
      "Stopped Redis — confirmed app falls back to DB without crashing",
      "Produced Kafka messages with accountId key — verified partition routing",
      "Observed consumer group rebalance when adding a second consumer",
      "Confirmed message durability — messages consumed after 2-minute consumer outage",
      "Read DDIA Chapters 9 and 11 — can explain CAP with a banking example"
    ]
  }

  ] // end design.weeks
}
