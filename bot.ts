#!/usr/bin/env -S deno run --allow-net=gateway.discord.gg,discord.com,www.speedrun.com --no-check --allow-env=DENO_DEPLOYMENT_ID,TOKEN,TEST_SERVER,PUBLIC_KEY --allow-read --no-prompt
import {
	ApplicationCommandInteraction,
	ApplicationCommandOption,
	ApplicationCommandOptionType,
	ApplicationCommandsModule,
	// autocomplete,
	AutocompleteInteraction,
	Client,
	InteractionsClient,
	// slash,
	SlashCommandPartial,
	User,
} from "https://deno.land/x/harmony@v2.9.1/mod.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

interface BaseGameAndSeries {
	id: string;
	name: string;
	url: string;
}

interface v2SearchResult {
	challengeList: unknown[];
	gameList: BaseGameAndSeries[];
	newsList: unknown[];
	pageList: unknown[];
	seriesList: BaseGameAndSeries[];
	userList: unknown[];
}

interface v1SearchResult {
	id: string;
	names: {
		international: string;
		japanese?: string;
		twitch: string;
	};
	abbreviation: string;
	weblink: string;
	discord: string;
	links: {
		rel: string;
		uri: string;
	}[];
}

const headers = {
	"Content-Type": "application/json",
	"User-Agent": "CommunityFinder/v3",
	Accept: "application/json",
};

const enum CommandNames {
	gameCommunity = "game-community",
	seriesCommunity = "series-community",
	sourceCode = "source-code",
}

const mentionUserOption: ApplicationCommandOption = {
	name: "mention",
	description: "Notify a user with the community's link",
	type: ApplicationCommandOptionType.USER,
};

const commands: SlashCommandPartial[] = [
	{
		name: CommandNames.gameCommunity,
		description: "Get a link to a game's community",
		options: [
			{
				name: "game",
				description: "A game's URL",
				type: ApplicationCommandOptionType.STRING,
				autocomplete: true,
				required: true,
			},
			mentionUserOption,
		],
	},
	{
		name: CommandNames.seriesCommunity,
		description: "Get a link to a series' community",
		options: [
			{
				name: "series",
				description: "A series' URL",
				type: ApplicationCommandOptionType.STRING,
				autocomplete: true,
				required: true,
			},
			mentionUserOption,
		],
	},
	{
		name: CommandNames.sourceCode,
		description: "Get a link to the bot's source code",
	},
];

async function reply(
	i: ApplicationCommandInteraction,
	content: string,
) {
	const userMention = i.option("mention");
	const allowedMentions = userMention instanceof User ? [userMention.id] : [];
	if (i.responded) {
		return await i.editResponse({
			content,
			allowedMentions: {
				users: allowedMentions,
			},
		});
	} else {
		return await i.reply(content, {
			allowedMentions: {
				users: allowedMentions,
			},
		});
	}
}

async function loading(i: ApplicationCommandInteraction) {
	const userMention = i.option("mention");
	const query = i.option("game") ?? i.option("series");
	if (userMention instanceof User) {
		return await reply(
			i,
			`${userMention}, fetching community link for the \`${query}\`...`,
		);
	} else await i.defer();
}

class SpeedrunCom extends ApplicationCommandsModule {
	// @slash(CommandNames.gameCommunity)
	async gameCommunity(i: ApplicationCommandInteraction) {
		const userMention = i.option("mention");
		const gameAbbreviation = i.option("game");
		await loading(i);

		const res = await fetch(
			`https://www.speedrun.com/api/v1/games/${gameAbbreviation}`,
			{ headers },
		);
		if (!res.ok && res.status !== 404) {
			const err = await res.text();
			console.error("Unexpected speedrun.com response: ", res.statusText, err);
			return await reply(
				i,
				`${
					userMention ? `${userMention}, ` : ""
				}Speedrun.com returned an unexpected error: ${res.statusText}; ${
					err.length < 1800 ? `Body: \`\`\`${err}\`\`\`` : ""
				}`,
			);
		}
		if (res.status === 404) {
			await reply(
				i,
				userMention
					? `${userMention}, the \`${gameAbbreviation}\` game wasn't found`
					: `The \`${gameAbbreviation}\` game wasn't found`,
			);
			return;
		}
		const game: v1SearchResult = (await res.json()).data;
		if (userMention) {
			await reply(
				i,
				game.discord
					? `${userMention}, here's the invite to \`${game.names.international}\`: ${game.discord}`
					: `${userMention}, couldn't find any Discord invite for \`${game.names.international}\`. Here's a link to their forums: ${game.weblink}/forums`,
			);
			return;
		}

		await reply(
			i,
			game.discord
				? `Here's the invite to \`${game.names.international}\`: ${game.discord}`
				: `Couldn't find any Discord invite for \`${game.names.international}\`. Here's a link to their forums: ${game.weblink}/forums`,
		);
	}

	// @slash(CommandNames.seriesCommunity)
	async seriesCommunity(i: ApplicationCommandInteraction) {
		const userMention = i.option("mention");
		const seriesAbbreviation = i.option("series");
		await loading(i);

		const res = await fetch(
			`https://www.speedrun.com/api/v1/series/${seriesAbbreviation}`,
			{ headers },
		);
		if (!res.ok && res.status !== 404) {
			const err = await res.text();
			console.error("Unexpected speedrun.com response: ", res.statusText, err);
			return await reply(
				i,
				`${
					userMention ? `${userMention}, ` : ""
				}Speedrun.com returned an unexpected error: ${res.statusText}; ${
					err.length < 1800 ? `Body: \`\`\`${err}\`\`\`` : ""
				}`,
			);
		}

		if (res.status === 404) {
			await reply(
				i,
				userMention
					? `${userMention}, the \`${seriesAbbreviation} Series\` wasn't found`
					: `The \`${i.option("series")} Series\` wasn't found`,
			);
			return;
		}

		const series: v1SearchResult = (await res.json()).data;
		// series.weblink doesn't have the "/series/" prefix
		const formLink =
			`https://www.speedrun.com/series/${series.abbreviation}/forums`;

		if (userMention) {
			await reply(
				i,
				series.discord
					? `${userMention}, here's the invite to the \`${series.names.international} Series\`: ${series.discord}`
					: `${userMention}, couldn't find any Discord invite for the \`${series.names.international} Series\`. Here's a link to their forums: ${formLink}`,
			);
			return;
		}

		await i.reply(
			series.discord
				? `Here's the invite to the \`${series.names.international} Series\`: ${series.discord}`
				: `Couldn't find any Discord invite for the \`${series.names.international} Series\`. Here's a link to their forums: ${formLink}`,
		);
	}

	// @slash(CommandNames.sourceCode)
	async sourceCode(i: ApplicationCommandInteraction) {
		await reply(
			i,
			"Here's the link to the repository: https://github.com/AnInternetTroll/speedruncom-discord-bot",
		);
	}

	// @autocomplete("*", "*")
	async complete(d: AutocompleteInteraction) {
		if (!d.focusedOption.value) {
			await d.autocomplete([]);
			return;
		}

		const isGame = d.focusedOption.name === "game";

		const v2Res = await fetch("https://www.speedrun.com/api/v2/GetSearch", {
			body: JSON.stringify({
				query: d.focusedOption.value,
				limit: 20,
				favorExactMatches: false,
				includeGames: isGame,
				includeSeries: !isGame,
			}),
			headers,
			method: "POST",
		});

		if (v2Res.ok) {
			const body: v2SearchResult = await v2Res.json();

			const list = isGame ? body.gameList : body.seriesList;
			await d.autocomplete(
				list.map((x) => ({
					name: isGame ? x.name : `${x.name} Series`,
					value: x.url,
				})),
			);
			return;
		} else {
			console.warn(
				"Unexpected speedrun.com response: ",
				v2Res.status,
				await v2Res.text(),
			);
		}

		// API v1 runs if API v2 fails
		const v1Res = await fetch(
			`https://www.speedrun.com/api/v1/${isGame ? "games" : "series"}?name=${
				encodeURIComponent(
					d.focusedOption.value,
				)
			}`,
			{ headers },
		);
		if (!v1Res.ok) {
			console.error(
				"Unexpected speedrun.com response: ",
				v1Res.status,
				await v1Res.text(),
			);
			return await d.autocomplete([]);
		}
		const v1Body: v1SearchResult[] = (await v1Res.json()).data;

		await d.autocomplete(
			v1Body.map((x) => ({
				name: isGame
					? x.names.international
					: `${x.names.international} Series`,
				value: x.abbreviation,
			})),
		);
		return;
	}
}

async function updateCommands() {
	const client = new Client({
		token: Deno.env.get("TOKEN"),
		intents: [],
	});
	await client.connect();
	await client.interactions.commands.bulkEdit(
		commands,
		Deno.env.get("TEST_SERVER"),
	);
	await client.off();
}

// Disabling decorators because they require a config file on deno deploy
// https://deno.com/deploy/changelog#es-decorators-are-enabled-on-deno-deploy-replacing-experimental-ts-decorators
function addEventsToInteractionClient(client: InteractionsClient) {
	const speedrunCom = new SpeedrunCom();
	// client.loadModule(speedrunCom);

	client.on("interactionError", (e) => {
		console.error(e);
	});

	client.on("interaction", async (i) => {
		try {
			if (i.isAutocomplete()) {
				return speedrunCom.complete(i);
			} else if (i.isApplicationCommand()) {
				switch (i.name as CommandNames) {
					case CommandNames.gameCommunity:
						await speedrunCom.gameCommunity(i);
						break;
					case CommandNames.seriesCommunity:
						await speedrunCom.seriesCommunity(i);
						break;
					case CommandNames.sourceCode:
						await speedrunCom.sourceCode(i);
						break;
					default:
						console.log("Command not found", i.name);
						break;
				}
			} else {
				console.log("Interaction not found", i.type);
			}
		} catch (error) {
			console.error("Unexpected error:", error);
		}
	});
}

if (import.meta.main) {
	if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
		const client = new InteractionsClient({
			publicKey: Deno.env.get("PUBLIC_KEY"),
			token: Deno.env.get("TOKEN"),
		});
		addEventsToInteractionClient(client);
		// Too slow, so we have to run this in the background
		updateCommands();

		Deno.serve((request) => {
			const url = new URL(request.url);
			const { pathname } = url;
			switch (pathname) {
				case "/discord-interaction": {
					// deno-lint-ignore no-async-promise-executor
					return new Promise(async (res) => {
						const interaction = await client.verifyFetchEvent({
							respondWith: res,
							request,
						});
						if (interaction === false) {
							return res(
								new Response(null, {
									status: 401,
								}),
							);
						}
						if (interaction.type === 1) return interaction.respond({ type: 1 });
						await client._process(interaction);
					});
				}
				default: {
					return new Response("Not found", {
						status: 404,
					});
				}
			}
		});
	} else {
		// This is needed to load the .env file
		await load({
			export: true,
		});

		const client = new Client({
			token: Deno.env.get("TOKEN"),
			intents: [],
		});
		console.log("Connecting to discord...");
		addEventsToInteractionClient(client.interactions);
		await client.connect();
		console.log("Connected");
		if (Deno.args.includes("--update")) {
			console.log("Updating slash commands...");
			await updateCommands();
			console.log("Updated slash commands");

			console.log("Closing");
			await client.off();
			console.log("Closed");

			Deno.exit(0);
		}
	}
}
