# Lab 1 — AI Use and Reflection

**LLM/agent used:** <name>

## Selected key prompts (6–10)
| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| Plan Lab 1 Implementation | I want you to read every file in the architecture. Please fill a full report of what you see. I also want you to include in this report what tools I will have to install to start successfully the project in my browser. | I had to understand the project at first – I wanted an actual overview of the structure of the project |
| Set Up Full-Stack Project | Here is our first task : Technical setup Required branch: feature/1-project-foundation Acceptance criteria: React + TypeScript + Vite frontend starts successfully? Bootstrap is installed and visible in the frontend. Node.js + Express + TypeScript backend starts successfully.	PostgreSQL is reachable and Prisma is initialized.	Vitest and Supertest commands are configured.	.gitignore and .env.example exist; secrets and node_modules are not committed.	Initial README setup instructions are present. I want you to specify theses requirements and ask me if you got it right. Then proceed the modifications. Once you are done, please fill a full report to explain what you did and why does it fulfil only these requirements. | It worked well at first attempt, but I didn’t REALLY understand what the agent did in first place. I had to ask for further explanations. |
| Implement Health Check | Now, we are ready to go on issue two. Required branch: feature/2-health-check; We are gonna go step by step on this one. Here is your task : GET /api/health returns HTTP 200. At first, I want you to explain your plan and ask me for permission to apply it.| I attempted to shorten the tasks to understand better what the agent does step-by-step. However, the tasks were too short for the agent to have an overall view and got a little messy. I had to give it the full issue then Solve it bit by bit. |
| Implement Category Feature | let’s move on onto the next step. We have now to specify issue 3 requirements. Here they are : Acceptance criteria: A Prisma Category model exists with id, unique name, and createdAt. A migration creates the Category table. The seed inserts Account and Access, Hardware, Software, and Network. The seed is safe to run more than once without duplicates. Database credentials are not committed. Please specify these requirements and fill a report about what to do, in what order and how to do it to reach these goals.| I told the agent to describe what to do so I can do it myself and truly understand what I am doing with my code.  |
| Diagnose stuck Loading state |  | It didn’t work first time because I was not tedious with my prompts, I had to be more patient and furnish more elements. |
| Review Final Lab 1 Work | Perfect, everything works as desired. I took screenshots throughout my progress. Here is the full PDF of the lab. I need to make a report, could you make me a template? | I got straight to the point and had the template I needed. |

## Reflection
Two or three sentences: what made your prompts better, and one place you had to
correct or reject what the agent produced.

I had to think about several things : why do I use this prompt and not another ? Can this task be broken into smallertasks that I can efficiently do instead of relying on AI ?
I didn't had issues through my work beside my own forgots. I had to tell the agent when it was getting outside what I really needed.

