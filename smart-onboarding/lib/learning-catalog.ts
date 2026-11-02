import type { LearningModule, LearningModuleId } from "@/types/learning";

/**
 * Shown on every module. The content below is original and written for this demo; it is
 * not certified training and does not replace an organisation's own policies or legal advice.
 */
export const LEARNING_DISCLAIMER = "Illustrative content — not certified compliance training";

export const LEARNING_MODULES: readonly LearningModule[] = [
  {
    id: "culture-values",
    title: "Company Culture & Values",
    summary: "How we work together, what we value, and where to find your way around.",
    durationMinutes: 15,
    lessons: [
      {
        id: "values",
        title: "Our three values",
        body: [
          "Three values guide how colleagues work together here: be curious, own it together, and keep it human.",
          "Being curious means asking questions early, sharing what you learn and treating mistakes as information. Owning it together means taking responsibility for outcomes as a team, not only for your own task list. Keeping it human means being respectful, kind and clear, especially when things are busy.",
        ],
        keyPoints: [
          "Ask questions early: nobody expects you to know everything in your first weeks.",
          "Outcomes are shared, so offer help and ask for it.",
          "Respect and clarity matter most under pressure.",
        ],
      },
      {
        id: "ways-of-working",
        title: "Everyday ways of working",
        body: [
          "Most teams plan their work in short cycles and review it together. Decisions are written down so that people who were not in the meeting can follow them.",
          "Feedback is part of normal work, not a special event. You will hear what is going well and what could be better, and you are encouraged to give the same in return.",
        ],
        keyPoints: [
          "Write decisions down so everyone can follow them.",
          "Feedback flows in both directions and is part of everyday work.",
        ],
      },
      {
        id: "finding-help",
        title: "Finding help and people",
        body: [
          "Your manager helps with your role and priorities. Your HR partner helps with onboarding, policies and wellbeing. Your onboarding buddy is there for everyday questions, such as where to find a document or who to ask about a tool.",
          "If you are unsure who to ask, start with your buddy. Asking is always better than guessing.",
        ],
        keyPoints: [
          "Manager: role and priorities. HR partner: onboarding and policies. Buddy: everyday questions.",
          "When in doubt, ask your buddy first.",
        ],
      },
    ],
    quiz: {
      passMark: 75,
      questions: [
        {
          id: "q1",
          prompt: "Which of these is one of the three values described in this module?",
          options: [
            { id: "a", text: "Move fast and break things" },
            { id: "b", text: "Own it together" },
            { id: "c", text: "Always work alone" },
          ],
          correctOptionId: "b",
          explanation: "The three values are: be curious, own it together, and keep it human.",
        },
        {
          id: "q2",
          prompt: "You are not sure how something works in your first week. What does the module suggest?",
          options: [
            { id: "a", text: "Ask early. Nobody expects you to know everything yet." },
            { id: "b", text: "Wait until you have figured it out alone" },
            { id: "c", text: "Avoid the topic until your 90-day review" },
          ],
          correctOptionId: "a",
          explanation: "Being curious means asking questions early and sharing what you learn.",
        },
        {
          id: "q3",
          prompt: "Why are decisions written down?",
          options: [
            { id: "a", text: "To assign blame later" },
            { id: "b", text: "Because meetings are not allowed" },
            { id: "c", text: "So people who were not in the meeting can follow them" },
          ],
          correctOptionId: "c",
          explanation: "Written decisions keep everyone informed, including people who missed the discussion.",
        },
        {
          id: "q4",
          prompt: "Who is the first person to ask about an everyday question, such as where to find a document?",
          options: [
            { id: "a", text: "Your onboarding buddy" },
            { id: "b", text: "The CEO" },
            { id: "c", text: "Nobody: try to guess" },
          ],
          correctOptionId: "a",
          explanation: "Your buddy is there for everyday questions. Asking is always better than guessing.",
        },
      ],
    },
  },
  {
    id: "data-protection",
    title: "Data Protection Essentials",
    summary: "Everyday habits for handling personal and confidential information with care.",
    durationMinutes: 20,
    lessons: [
      {
        id: "what-is-personal-data",
        title: "What counts as personal data",
        body: [
          "Personal data is any information that relates to an identifiable person: a name, an email address, an employee number, a photo, or a combination of details that points to someone.",
          "Colleagues, customers and candidates all trust us with information about them. Treating it with care is part of everyone's job, not only of specialist teams.",
        ],
        keyPoints: [
          "If information can identify a person, treat it as personal data.",
          "Handling it carefully is everyone's responsibility.",
        ],
      },
      {
        id: "everyday-habits",
        title: "Everyday habits",
        body: [
          "Only collect and keep what you need for the task. Share information on a need-to-know basis, using the approved tools rather than personal accounts or unapproved apps.",
          "Lock your screen when you step away, store files in the agreed places and delete working copies you no longer need, following your company's retention rules.",
        ],
        keyPoints: [
          "Collect and keep only what is needed.",
          "Share on a need-to-know basis, through approved tools.",
          "Lock your screen and tidy up copies you no longer need.",
        ],
      },
      {
        id: "incidents",
        title: "Spotting and reporting incidents",
        body: [
          "An incident can be as simple as an email sent to the wrong person, a lost laptop, or a suspicious message asking for your login details.",
          "Report anything unusual quickly through your company's reporting route or to your data protection contact. Early reporting limits harm; nobody is blamed for reporting in good faith. Follow your organisation's own policies, which take precedence over this summary.",
        ],
        keyPoints: [
          "Misdirected emails, lost devices and phishing attempts are all incidents.",
          "Report quickly through the official route; reporting in good faith is encouraged.",
          "Your organisation's own policies always take precedence.",
        ],
      },
    ],
    quiz: {
      passMark: 80,
      questions: [
        {
          id: "q1",
          prompt: "Which of these is personal data?",
          options: [
            { id: "a", text: "The office opening hours" },
            { id: "b", text: "A colleague's employee number" },
            { id: "c", text: "The name of a software product" },
          ],
          correctOptionId: "b",
          explanation: "An employee number identifies a person, so it is personal data.",
        },
        {
          id: "q2",
          prompt: "A colleague asks you to send a customer list to their personal email. What should you do?",
          options: [
            { id: "a", text: "Send it, since they are a colleague" },
            { id: "b", text: "Send only half of the list" },
            { id: "c", text: "Use approved tools and share only what they need" },
          ],
          correctOptionId: "c",
          explanation: "Share on a need-to-know basis, through approved tools rather than personal accounts.",
        },
        {
          id: "q3",
          prompt: "You notice you emailed a document to the wrong person. What is the best next step?",
          options: [
            { id: "a", text: "Report it quickly through the official reporting route" },
            { id: "b", text: "Say nothing and hope it is ignored" },
            { id: "c", text: "Wait a week to see if anything happens" },
          ],
          correctOptionId: "a",
          explanation: "Early reporting limits harm, and reporting in good faith is encouraged.",
        },
        {
          id: "q4",
          prompt: "What should you do when you step away from your laptop?",
          options: [
            { id: "a", text: "Leave it open so you can continue quickly" },
            { id: "b", text: "Lock the screen" },
            { id: "c", text: "Turn the brightness down" },
          ],
          correctOptionId: "b",
          explanation: "Locking your screen keeps information safe while you are away.",
        },
        {
          id: "q5",
          prompt: "How much personal data should you collect for a task?",
          options: [
            { id: "a", text: "As much as possible, in case it is useful later" },
            { id: "b", text: "Only what you need for the task" },
            { id: "c", text: "Whatever the form allows" },
          ],
          correctOptionId: "b",
          explanation: "Collect and keep only what is needed for the task.",
        },
      ],
    },
  },
  {
    id: "health-safety",
    title: "Workplace Health & Safety",
    summary: "Staying safe and well, whether you work in the office or at home.",
    durationMinutes: 15,
    lessons: [
      {
        id: "emergencies",
        title: "In an emergency",
        body: [
          "In the office, find out where the nearest emergency exits and assembly point are during your first days. Follow the instructions of the people responsible for evacuation, and never use lifts during an evacuation.",
          "Wherever you work, keep your local emergency number in mind and make sure someone knows how to reach you if you work alone.",
        ],
        keyPoints: [
          "Know your nearest exits and assembly point.",
          "Do not use lifts during an evacuation.",
          "If you work alone, make sure someone can reach you.",
        ],
      },
      {
        id: "workstation",
        title: "A comfortable workstation",
        body: [
          "Set your screen at roughly eye level and an arm's length away, keep your feet supported and your wrists relaxed. Small adjustments prevent strain over time.",
          "Take short breaks from the screen regularly. Standing up, stretching and looking into the distance all help.",
        ],
        keyPoints: [
          "Screen at eye level, about an arm's length away.",
          "Take short, regular breaks from the screen.",
        ],
      },
      {
        id: "reporting-wellbeing",
        title: "Reporting hazards and looking after yourself",
        body: [
          "If you see a hazard, such as a trailing cable, a broken chair or a blocked exit, report it through your company's reporting route so it can be fixed.",
          "Wellbeing is part of safety. If workload or stress becomes difficult, talk to your manager or HR partner early. Follow your organisation's own health and safety policies, which take precedence over this summary.",
        ],
        keyPoints: [
          "Report hazards so they can be fixed.",
          "Raise workload or stress concerns early with your manager or HR partner.",
        ],
      },
    ],
    quiz: {
      passMark: 75,
      questions: [
        {
          id: "q1",
          prompt: "What should you avoid during an office evacuation?",
          options: [
            { id: "a", text: "Using the lifts" },
            { id: "b", text: "Following the evacuation instructions" },
            { id: "c", text: "Going to the assembly point" },
          ],
          correctOptionId: "a",
          explanation: "Never use lifts during an evacuation; use the emergency exits.",
        },
        {
          id: "q2",
          prompt: "Where should your screen be?",
          options: [
            { id: "a", text: "As close to your face as possible" },
            { id: "b", text: "Roughly at eye level, about an arm's length away" },
            { id: "c", text: "Below the desk" },
          ],
          correctOptionId: "b",
          explanation: "Eye level and about an arm's length away helps prevent strain.",
        },
        {
          id: "q3",
          prompt: "You notice a cable trailing across a walkway. What should you do?",
          options: [
            { id: "a", text: "Step over it and carry on" },
            { id: "b", text: "Report it so it can be fixed" },
            { id: "c", text: "Wait for someone else to notice" },
          ],
          correctOptionId: "b",
          explanation: "Reporting hazards means they can be fixed before anyone gets hurt.",
        },
        {
          id: "q4",
          prompt: "Your workload is becoming stressful. What does the module suggest?",
          options: [
            { id: "a", text: "Keep it to yourself" },
            { id: "b", text: "Work longer hours until it passes" },
            { id: "c", text: "Talk to your manager or HR partner early" },
          ],
          correctOptionId: "c",
          explanation: "Wellbeing is part of safety; raising concerns early helps.",
        },
      ],
    },
  },
  {
    id: "remote-working",
    title: "Remote Working Essentials",
    summary: "Collaborating well, staying connected and keeping healthy boundaries when you work remotely.",
    durationMinutes: 10,
    lessons: [
      {
        id: "communication",
        title: "Communicating across distance",
        body: [
          "Remote teams rely on clear written communication. Give enough context in your messages that someone can act on them without a meeting, and say when you need an answer.",
          "Use the right channel: chat for quick questions, shared documents for decisions, and calls when a topic needs discussion.",
        ],
        keyPoints: [
          "Write messages that make sense without extra context.",
          "Choose the channel that fits the conversation.",
        ],
      },
      {
        id: "staying-connected",
        title: "Staying connected",
        body: [
          "Distance makes casual conversations rarer, so plan for them. Short informal calls with your buddy and team help you build relationships.",
          "Share progress openly and ask for help in team channels: others cannot see when you are stuck.",
        ],
        keyPoints: [
          "Plan informal contact with your buddy and team.",
          "Make progress and blockers visible.",
        ],
      },
      {
        id: "boundaries",
        title: "Focus and boundaries",
        body: [
          "Agree your usual working hours with your team and show them in your calendar. Block time for focused work, and take real breaks away from the screen.",
          "At the end of the day, close your work tools. A clear end to the day helps you rest and come back refreshed.",
        ],
        keyPoints: [
          "Make your working hours visible.",
          "Block focus time and take real breaks.",
          "End the working day clearly.",
        ],
      },
    ],
  },
  {
    id: "leading-new-team",
    title: "Leading Your New Team",
    summary: "The first conversations, expectations and habits of a new people manager.",
    durationMinutes: 20,
    lessons: [
      {
        id: "first-conversations",
        title: "Your first conversations",
        body: [
          "In your first weeks, meet each person in your team individually. Listen more than you talk: ask what is going well, what gets in their way, and how they like to work and receive feedback.",
          "Share a little about yourself and how you like to work, so the relationship starts in both directions.",
        ],
        keyPoints: [
          "Meet each person individually in your first weeks.",
          "Listen first: what helps, what gets in the way, how they like feedback.",
        ],
      },
      {
        id: "expectations",
        title: "Setting clear expectations",
        body: [
          "People do their best work when they know what good looks like. Agree priorities and goals together and write them down.",
          "Keep regular 1:1s and protect that time. Consistency builds trust more than any single conversation.",
        ],
        keyPoints: [
          "Agree priorities and goals together, in writing.",
          "Protect regular 1:1s.",
        ],
      },
      {
        id: "feedback-support",
        title: "Feedback and support",
        body: [
          "Give specific, timely feedback about behaviour and its impact, not about personality. Recognise good work as readily as you raise concerns.",
          "You do not need to have every answer. Your HR partner and fellow managers are there to support you, especially with situations that are new to you.",
        ],
        keyPoints: [
          "Feedback should be specific, timely and about behaviour and impact.",
          "Ask your HR partner and peers for support.",
        ],
      },
    ],
    quiz: {
      passMark: 75,
      questions: [
        {
          id: "q1",
          prompt: "What is a good focus for your first 1:1 with each team member?",
          options: [
            { id: "a", text: "Listening to what helps them and what gets in their way" },
            { id: "b", text: "Presenting a long list of changes" },
            { id: "c", text: "Reviewing their performance rating" },
          ],
          correctOptionId: "a",
          explanation: "Early conversations are for listening and building the relationship.",
        },
        {
          id: "q2",
          prompt: "How should priorities and goals be set?",
          options: [
            { id: "a", text: "By the manager alone, without discussion" },
            { id: "b", text: "Together, and written down" },
            { id: "c", text: "They do not need to be set in the first 90 days" },
          ],
          correctOptionId: "b",
          explanation: "Agreeing priorities together and writing them down makes expectations clear.",
        },
        {
          id: "q3",
          prompt: "Which feedback is most useful?",
          options: [
            { id: "a", text: "“You are not a team player.”" },
            { id: "b", text: "Feedback saved up for the annual review" },
            { id: "c", text: "Specific, timely feedback about a behaviour and its impact" },
          ],
          correctOptionId: "c",
          explanation: "Specific, timely feedback about behaviour and impact is actionable.",
        },
        {
          id: "q4",
          prompt: "You face a team situation you have not handled before. What does the module suggest?",
          options: [
            { id: "a", text: "Ask your HR partner or fellow managers for support" },
            { id: "b", text: "Handle it alone so you look confident" },
            { id: "c", text: "Ignore it until it resolves itself" },
          ],
          correctOptionId: "a",
          explanation: "You do not need every answer; support is available.",
        },
      ],
    },
  },
];

export function findModule(id: string): LearningModule | undefined {
  return LEARNING_MODULES.find((m) => m.id === id);
}

export function getModule(id: LearningModuleId): LearningModule {
  const learningModule = findModule(id);
  if (!learningModule) throw new Error(`Unknown learning module: ${id}`);
  return learningModule;
}
