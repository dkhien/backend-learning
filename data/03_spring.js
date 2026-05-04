// ================================================================
// MODULE 3 — SPRING INTERNALS
// ================================================================
export default {
  id: "spring", title: "Spring Boot Internals", color: "#2a6614",
  tagClass: "tag-spring", icon: "🌱",
  desc: "Understand what Spring does at startup and at runtime. Knowing Spring's internals lets you read Backbase's code, debug startup failures, and reason about @Transactional without guessing.",
  weeks: [

  {
    id: "spring-w7", num: "Week 7", module: "spring",
    title: "IoC Container & Bean Lifecycle",
    subtitle: "What Spring does at startup — and why Backbase upgrade failures happen here",
    hours: 11, tagClasses: ["tag-spring","tag-time"], tagLabels: ["Spring Internals","~11 hours"],
    ddia: null,
    objectives: [
      "Describe the full bean lifecycle from instantiation through @PostConstruct to @PreDestroy",
      "Write a BeanPostProcessor that hooks into every bean creation event",
      "Explain how @Conditional annotations gate autoconfiguration",
      "Use /actuator/conditions to debug why a bean did or did not get created",
      "Resolve a ConflictingBeanDefinitionException caused by a Backbase starter"
    ],
    diagram: { type: "spring-lifecycle", caption: "Spring bean lifecycle — startup sequence" },
    setup: {
      desc: "Create a minimal Spring Boot app with the actuator. You will use it for both Week 7 and Week 8.",
      steps: [{
        text: "Add to pom.xml:",
        code:
`<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>`,
        lang: "yaml"
      },
      {
        text: "Enable all actuator endpoints in application.yml:",
        code:
`management:
  endpoints:
    web:
      exposure:
        include: "*"`,
        lang: "yaml"
      }]
    },
    labs: [
      {
        num: 1, title: "Hook into the container with a BeanPostProcessor",
        goal: "The best way to understand Spring's container is to instrument it. Write a BeanPostProcessor that runs for every single bean the container creates.",
        setup: {
          desc: "Use the banking-app from Week 3. All lab steps run in that existing app — no new project needed.",
          steps: [{
            text: "Make sure the app starts cleanly with: mvn spring-boot:run or via IntelliJ. You should see Spring startup logs and /actuator/health returning UP at http://localhost:8080/actuator/health"
          }]
        },
        explore: [
          {
            text: "Write a class that implements BeanPostProcessor with both methods. Log the bean name and class for every bean. Start the app and count how many beans were created by a minimal Spring Boot app.",
            reveal: true,
            code:
`@Component
public class BeanObserver implements BeanPostProcessor {
    private static final Logger log =
        LoggerFactory.getLogger(BeanObserver.class);

    @Override
    public Object postProcessBeforeInitialization(
        Object bean, String beanName) {
        // runs before @PostConstruct
        log.info("[BEFORE] {} ({})",
            beanName, bean.getClass().getSimpleName());
        return bean;
    }

    @Override
    public Object postProcessAfterInitialization(
        Object bean, String beanName) {
        // runs after @PostConstruct
        return bean;
    }
}`,
            lang: "java",
            note: "A minimal Spring Boot web app typically creates 200–400 beans. Most are internal Spring infrastructure beans."
          },
          {
            text: "Filter for proxied beans — beans whose class name contains '$$'. Log them with their real class. Add a @Service with @Transactional. Is it proxied? What is its actual class name?",
            code:
`// In postProcessAfterInitialization:
if (bean.getClass().getName().contains("$$")) {
    log.info("[PROXY] {} is wrapped as: {}",
        beanName, bean.getClass().getName());
}`,
            lang: "java",
            note: "CGLIB proxies appear as YourClass$$SpringCGLIB$$0. Any bean with @Transactional, @Async, or @Cacheable gets wrapped this way. This is how Spring adds behaviour without modifying your source code."
          },
          {
            text: "Research: what is the difference between BeanFactory and ApplicationContext? What additional services does ApplicationContext provide that BeanFactory does not?"
          }
        ],
        hints: [
          { label: "Why beans get proxied", body: "Spring creates a CGLIB subclass (proxy) for any bean that needs method interception: @Transactional (wrap method in transaction), @Async (run method on thread pool), @Cacheable (check cache before calling method). The proxy wraps the real bean. When external code calls the method, the proxy intercepts the call and adds the behaviour. This is why self-invocation breaks @Transactional — internal this.method() calls bypass the proxy." }
        ],
        solution: null
      },
      {
        num: 2, title: "Understand autoconfiguration",
        goal: "Spring Boot's 'add a dependency and it works' magic is autoconfiguration. When it breaks — or when you need to override it for Backbase — you need to understand the mechanism.",
        explore: [
          {
            text: "Start the app and hit the conditions endpoint. Find DataSourceAutoConfiguration and read what @Conditional annotations made it activate (or not).",
            code: "curl http://localhost:8080/actuator/conditions | python3 -m json.tool | grep -A5 'DataSource'",
            lang: "bash"
          },
          {
            text: "Write a conditional configuration and test both states.",
            code:
`@Configuration
@ConditionalOnProperty(
    name = "banking.audit.enabled",
    havingValue = "true"
)
public class AuditConfig {
    @Bean
    public AuditService auditService() {
        return new AuditService();
    }
}`,
            lang: "java",
            note: "Test with banking.audit.enabled=true in application.properties, then without it. Hit /actuator/conditions both times and find AuditConfig in the output — it will appear in positiveMatches or negativeMatches."
          },
          {
            text: "Simulate a Backbase-style conflict: define a @Bean of the same type that Spring Boot also autoconfigures (e.g. a custom Jackson ObjectMapper). Observe the ConflictingBeanDefinitionException. Then fix it with @ConditionalOnMissingBean on one of them.",
            note: "@ConditionalOnMissingBean means 'only create this bean if no other bean of this type exists yet'. Backbase starters use this pattern so your customisations take precedence over their defaults."
          }
        ],
        hints: [
          { label: "Reading the /actuator/conditions output", body: "The response has three sections: positiveMatches (conditions that passed — bean was created), negativeMatches (conditions that failed — bean was NOT created), and unconditionalClasses (always created). Each entry shows which @Conditional annotation was evaluated and what the result was. This is the most useful tool for debugging 'why did Backbase's bean not get created?'" }
        ],
        solution: null
      }
    ],
    refs: [
      { type: "Spring docs", name: "The IoC Container", url: "https://docs.spring.io/spring-framework/docs/current/reference/html/core.html#beans", desc: "Sections 1.1–1.7: bean definitions, dependencies, scopes, lifecycle callbacks." },
      { type: "Spring Boot docs", name: "Creating Auto-configuration", url: "https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.developing-auto-configuration", desc: "How @Conditional gates autoconfiguration. Essential for understanding Backbase starters." }
    ],
    checklist: [
      "BeanPostProcessor logs every bean — counted total beans at startup",
      "Identified all proxied beans and the annotations that caused them",
      "Used /actuator/conditions to explain a conditional bean activating or not",
      "Reproduced a bean definition conflict and resolved it with @ConditionalOnMissingBean",
      "Can explain the difference between BeanFactory and ApplicationContext"
    ]
  },

  {
    id: "spring-w8", num: "Week 8", module: "spring",
    title: "AOP, @Transactional & Spring Security Filter Chain",
    subtitle: "The proxy mechanism behind Spring's most critical features — and how Backbase auth hooks in",
    hours: 12, tagClasses: ["tag-spring","tag-time"], tagLabels: ["Spring Internals","~12 hours"],
    ddia: null,
    objectives: [
      "Explain how CGLIB proxies implement AOP without modifying source code",
      "Reproduce the self-invocation @Transactional bug and confirm the silent failure",
      "Fix the bug correctly using a separate service class",
      "Distinguish REQUIRED vs REQUIRES_NEW propagation — and explain when each is right in banking",
      "Trace a request through the Spring Security FilterChain"
    ],
    diagram: { type: "aop", caption: "CGLIB proxy interception — how @Transactional actually works" },
    labs: [
      {
        num: 1, title: "Break @Transactional with self-invocation",
        goal: "The most common Spring mistake across all experience levels. Reproduce the silent failure, verify it with a transaction name check, understand the mechanism, then fix it correctly.",
        setup: {
          desc: "Create a PaymentService with two @Transactional methods and a JPA repository.",
          steps: [{
            code:
`@Service
public class PaymentService {

    @Autowired
    private PaymentRepository repo,

    @Transactional
    public void processPayment(Payment p) {
        repo.save(p);
        // Calls another @Transactional method on 'this'
        validateAndNotify(p);
    }

    @Transactional(rollbackFor = Exception.class)
    public void validateAndNotify(Payment p) {
        String txName = TransactionSynchronizationManager
            .getCurrentTransactionName();
        log.info("Transaction name: {}", txName);

        if (p.getAmount().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Negative amount");
        }
    }
}`,
            lang: "java"
          }]
        },
        explore: [
          {
            text: "Call processPayment with a negative amount. Does it roll back the save()? Check the database to verify.",
            note: "Expected (broken) behaviour: save() is NOT rolled back even though validateAndNotify() throws. The transaction on validateAndNotify() was never started — the self-call bypassed the proxy."
          },
          {
            text: "Read the log line showing the transaction name inside validateAndNotify(). When called via self-invocation it will be null. When called from an external class it will show the transaction name. Verify both cases.",
            note: "null transaction name = no transaction context = the @Transactional annotation had no effect."
          },
          {
            text: "Draw the call flow on paper: external caller → proxy → real PaymentService.processPayment() → this.validateAndNotify() (direct, no proxy). Mark exactly where the proxy steps out of the picture."
          },
          {
            text: "Fix the bug by moving validateAndNotify() to a separate @Service class. Call it via injection. Re-run the test and verify the rollback now works correctly.",
            code:
`@Service
public class PaymentValidationService {

    @Transactional(rollbackFor = Exception.class)
    public void validateAndNotify(Payment p) {
        // Now intercepted by ITS OWN proxy
        if (p.getAmount().compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Negative amount");
        }
    }
}`,
            lang: "java"
          }
        ],
        hints: [
          { label: "Why fix (c) — REQUIRES_NEW — does not work", body: "Adding REQUIRES_NEW to validateAndNotify() does not fix self-invocation. REQUIRES_NEW is implemented on the proxy, not on the method. The self-call this.validateAndNotify() bypasses the proxy entirely — Spring never gets a chance to start a new transaction. Fix (a) — separate class — is always the cleanest. Fix (b) — inject self — works but smells like circular dependency. Fix (c) — REQUIRES_NEW — does not work." }
        ],
        solution: null
      },
      {
        num: 2, title: "REQUIRES_NEW — audit log independence",
        goal: "In banking, audit logs must be written even when the main transaction fails. REQUIRES_NEW creates an independent transaction for exactly this purpose.",
        explore: [
          {
            text: "Build the scenario: PaymentService saves a payment and calls AuditService.logAudit() — which uses REQUIRED (default). Throw a RuntimeException after the audit call. Check the database — did the audit log survive?",
            reveal: true,
            code:
`@Service
public class AuditService {

    @Transactional(propagation = Propagation.REQUIRED)
    public void logAudit(String action, Long entityId) {
        auditRepo.save(new AuditEntry(action, entityId));
    }
}`,
            lang: "java",
            note: "With REQUIRED: the audit log is part of the same transaction as the payment. When the payment rolls back, the audit log rolls back too. The audit log is lost."
          },
          {
            text: "Change AuditService to REQUIRES_NEW. Repeat the test. Does the audit log survive the payment rollback now?",
            note: "With REQUIRES_NEW: Spring suspends the outer transaction, starts a fresh inner transaction for the audit, commits it immediately, then resumes the outer transaction. The audit log is committed independently."
          },
          {
            text: "Design question: a payment processing flow has these steps — validate → reserve funds → call external payment API → record transfer → send notification. Which steps should share a transaction? Which need their own? Write your answer and reasoning."
          }
        ],
        hints: [
          { label: "REQUIRED vs REQUIRES_NEW — when to use each", body: "REQUIRED (default): join existing transaction if one exists, otherwise create new. All steps are atomic together — any failure rolls everything back. Use for: multi-step operations that must be atomic (debit + credit in a transfer). REQUIRES_NEW: always create a new transaction, suspend any outer transaction. Use for: audit logs (must survive outer rollback), idempotency records, notification events (fire-and-forget). Never use REQUIRES_NEW for the main business logic — it breaks atomicity." }
        ],
        solution: null
      }
    ],
    refs: [
      { type: "Spring docs", name: "Declarative Transaction Management", url: "https://docs.spring.io/spring-framework/docs/current/reference/html/data-access.html#transaction-declarative", desc: "The proxy mechanism explained. Read 'Understanding the Spring Framework Declarative Transaction Mechanism'." },
      { type: "Spring docs", name: "Spring AOP", url: "https://docs.spring.io/spring-framework/docs/current/reference/html/core.html#aop", desc: "Proxy types, pointcuts, advice. Read Sections 5.1–5.8." },
      { type: "Spring Security", name: "Servlet Security Architecture", url: "https://docs.spring.io/spring-security/reference/servlet/architecture.html", desc: "FilterChain diagram — essential for understanding how Backbase auth integrates." }
    ],
    checklist: [
      "Reproduced self-invocation bug — verified save() is NOT rolled back",
      "Confirmed via transaction name log that no transaction exists in the self-called method",
      "Fixed bug with a separate service class — verified rollback works",
      "Demonstrated REQUIRES_NEW: audit log persists when payment rolls back",
      "Can explain all propagation levels and when to use REQUIRED vs REQUIRES_NEW"
    ]
  }

  ] // end spring.weeks
}
