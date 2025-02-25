using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text.Json.Nodes;
using Prog3_WebApi_Javascript.DTOs;

namespace Prog3_WebApi_Javascript.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GPTController : ControllerBase
    {
        private readonly HttpClient _client;

        public GPTController(IConfiguration config)
        {
            _client = new HttpClient();
            string api_key = config.GetValue<string>("OpenAI:Key");
            _client.DefaultRequestHeaders.Add("Authorization", "Bearer " + api_key);
        }

        [HttpGet("ping")]
        public IActionResult Ping()
        {
            return Ok();
        }


        

        [HttpPost("GetWelcomeMessage")]
        public async Task<IActionResult> GetWelcomeMessage([FromBody] AliyahApplicationDTO aliyahApp)
        {
            try
            {
                string endpoint = "https://api.openai.com/v1/chat/completions";
                string model = "gpt-3.5-turbo";
                int max_tokens = 150;
                double temperature = 0.7;

                var messages = new List<Message>
                {
                    new Message
                    {
                        role = "system",
                        content = $"Generate a welcome message in the following format as a JSON array: " +
                                  $"[\"greeting\", \"subtitle\", \"hebrewName\"]. " +
                                  $"The greeting should be 'Hello, {aliyahApp.FullName}' in {aliyahApp.Language}, " +
                                  $"the subtitle should be 'I am your personal assistant for Aliyah. How can I help you today?' in {aliyahApp.Language}, " +
                                  $"and hebrewName should be the translation of '{aliyahApp.FullName}' to Hebrew. " +
                                  $"Return ONLY the JSON array."
                    }
                };

                var request = new GPTRequest
                {
                    max_tokens = max_tokens,
                    model = model,
                    temperature = temperature,
                    messages = messages
                };

                var res = await _client.PostAsJsonAsync(endpoint, request);

                if (!res.IsSuccessStatusCode)
                {
                    var errorContent = await res.Content.ReadAsStringAsync();
                    return BadRequest($"OpenAI API Error: {errorContent}");
                }

                var jsonFromGPT = await res.Content.ReadFromJsonAsync<JsonObject>();
                if (jsonFromGPT == null)
                {
                    return BadRequest("Empty response from OpenAI");
                }

                string content = jsonFromGPT["choices"]?[0]?["message"]?["content"]?.ToString();
                if (string.IsNullOrEmpty(content))
                {
                    return BadRequest("No content in response");
                }

                return Ok(new { content = JsonSerializer.Deserialize<List<string>>(content) });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error: {ex.Message}");
            }
        }


        [HttpPost("GenerateSuggestedQuestions")]
        public async Task<IActionResult> GenerateSuggestedQuestions([FromBody] dynamic data)
        {
            try
            {
                // Deserialize with flexible options
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                var aliyahApp = JsonSerializer.Deserialize<AliyahApplicationDTO>(
                    data.ToString(),
                    options
                );

                string endpoint = "https://api.openai.com/v1/chat/completions";
                string model = "gpt-4o-mini";
                int max_tokens = 150;
                double temperature = 0.7;

                var messages = new List<Message>
                {
                    new Message
                    {
                        role = "system",
                        content = "Generate exactly 3 questions that would be most relevant for a new immigrant " +
                                  $"based on their profile. The questions MUST be phrased as if the user is directly asking GPT. The  questions MUST be in this language: {aliyahApp.Language}. Return ONLY a JSON array in the exact format: " +
                                  "[\"question1\", \"question2\", \"question3\"]. " +
                                  $"User Details - Name: {aliyahApp.FullName}, " +
                                  $"From: {aliyahApp.CountryOfOrigin}, " +
                                  $"Language: {aliyahApp.Language}, " +
                                  $"Aliyah Stage: {aliyahApp.ProcessStage}, " +
                                  $"Jewish Status: {(aliyahApp.IsJewish ? "Jewish" : "Not Jewish")}, " +
                                  $"Aliyah Chances: {aliyahApp.AliyahChances}. " +
                                  $"Make sure all questions are in the user's language: {aliyahApp.Language}"
                    }
                };

                var request = new GPTRequest
                {
                    max_tokens = max_tokens,
                    model = model,
                    temperature = temperature,
                    messages = messages
                };
                Console.WriteLine("Sending request to GPT:");
                Console.WriteLine(JsonSerializer.Serialize(request));

                var res = await _client.PostAsJsonAsync(endpoint, request);

                if (!res.IsSuccessStatusCode)
                {
                    var errorContent = await res.Content.ReadAsStringAsync();
                    return BadRequest($"OpenAI API Error: {errorContent}");
                }

                var jsonFromGPT = await res.Content.ReadFromJsonAsync<JsonObject>();
                if (jsonFromGPT == null)
                {
                    return BadRequest("Empty response from OpenAI");
                }

                Console.WriteLine("Raw GPT Response:");
                Console.WriteLine(jsonFromGPT);

                string content = jsonFromGPT["choices"]?[0]?["message"]?["content"]?.ToString();
                if (string.IsNullOrEmpty(content))
                {
                    return BadRequest("No content in response");
                }

                try
                {
                    // Verify the content is valid JSON array
                    var questions = JsonSerializer.Deserialize<List<string>>(content);
                    if (questions == null || questions.Count != 3)
                    {
                        // Fallback questions if needed
                        questions = new List<string>
                        {
                            $"What are the next steps in my {aliyahApp.ProcessStage}?",
                            $"What documents do I need to prepare as someone from {aliyahApp.CountryOfOrigin}?",
                            "What financial assistance is available for new Olim?"
                        };
                    }

                    return Ok(new { content = questions });
                }
                catch
                {
                    // Return default questions if parsing fails
                    var defaultQuestions = new List<string>
                    {
                        $"What are the next steps in my {aliyahApp.ProcessStage}?",
                        $"What documents do I need to prepare as someone from {aliyahApp.CountryOfOrigin}?",
                        "What financial assistance is available for new Olim?"
                    };

                    return Ok(new { content = defaultQuestions });
                }
            }
            catch (Exception ex)
            {
                var errorMessage = $"Error processing request: {ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMessage += $" Inner exception: {ex.InnerException.Message}";
                }

                return StatusCode(500, errorMessage);
            }
        }


        [HttpPost("GPTChat")]
        public async Task<IActionResult> GPTChat([FromBody] dynamic data)
        {
            try
            {
                // Deserialize with flexible options
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                // Extract prompt and application data
                var prompt = JsonSerializer.Deserialize<Prompt>(
                    data.GetProperty("prompt").ToString(),
                    options
                );

                var aliyahApp = JsonSerializer.Deserialize<AliyahApplicationDTO>(
                    data.GetProperty("aliyahApplication").ToString(),
                    options
                );

                // Log received application details
                Console.WriteLine($"Received Application Details:");
                Console.WriteLine($"Full Name: {aliyahApp.FullName}");
                Console.WriteLine($"Birth Date: {aliyahApp.BirthDate}");
                Console.WriteLine($"Language: {aliyahApp.Language}");
                Console.WriteLine($"Country: {aliyahApp.CountryOfOrigin}");
                Console.WriteLine($"Aliyah Reason: {aliyahApp.AliyahReason}");
                Console.WriteLine($"Process Stage: {aliyahApp.ProcessStage}");
                Console.WriteLine($"Is Jewish: {aliyahApp.IsJewish}");
                Console.WriteLine($"Aliyah Chances: {aliyahApp.AliyahChances}");

                string endpoint = "https://api.openai.com/v1/chat/completions";
                string model = "gpt-4o-mini";
                int max_tokens = 300;
                double temperature = 0.7;

                var messages = new List<Message>
                {
                    new Message
                    {
                        role = "system",
                        content =
                            "Your name is Ally and you are a friendly, supportive, knowledgeable guide for new immigrants and individuals interested in moving to Israel. " +
                            "You base your answers primarily on the information provided within the JSON data. " +
                            "If the answer is not in the base data, complete from the model itself. " +
                            "If you need more specific information to provide a better answer, ask the user. " +
                            "If necessary, ask clarifying questions to better understand the user's intent. " +
                            $"Make your responses conversational and engaging. Make sure to answer in the User's language: {aliyahApp.Language}. " +
                            "Consider the full conversation history when responding. " +
                            "Format your response using HTML tags to structure and style the content appropriately. " +
                            "Use tags like <p> for paragraphs, <strong> for emphasis, <ul> and <li> for lists, etc. " +
                            "Make sure to close all HTML tags properly. The response should be valid HTML that can be directly " +
                            "inserted into a web page. " +
                            $"User Details - Name: {aliyahApp.FullName}, " +
                            $"From: {aliyahApp.CountryOfOrigin}, " +
                            $"Language: {aliyahApp.Language}, " +
                            $"Aliyah Stage: {aliyahApp.ProcessStage}, " +
                            $"Jewish Status: {(aliyahApp.IsJewish ? "Jewish" : "Not Jewish")}, " +
                            $"Aliyah Chances: {aliyahApp.AliyahChances}"
                    }
                };

                // Add previous chat history if available
                if (prompt.ChatHistory != null)
                {
                    foreach (var msg in prompt.ChatHistory)
                    {
                        if (!string.IsNullOrEmpty(msg.role) && !string.IsNullOrEmpty(msg.content))
                        {
                            messages.Add(msg);
                        }
                    }
                }

                // Add current user question
                messages.Add(new Message
                {
                    role = "user",
                    content = prompt.Question
                });

                var request = new GPTRequest
                {
                    max_tokens = max_tokens,
                    model = model,
                    temperature = temperature,
                    messages = messages
                };

                var res = await _client.PostAsJsonAsync(endpoint, request);

                if (!res.IsSuccessStatusCode)
                {
                    var errorContent = await res.Content.ReadAsStringAsync();
                    return BadRequest($"OpenAI API Error: {errorContent}");
                }

                var jsonFromGPT = await res.Content.ReadFromJsonAsync<JsonObject>();
                if (jsonFromGPT == null)
                {
                    return BadRequest("Empty response from OpenAI");
                }

                string content = jsonFromGPT["choices"]?[0]?["message"]?["content"]?.ToString();
                if (string.IsNullOrEmpty(content))
                {
                    return BadRequest("No content in response");
                }

                Console.WriteLine("GPT Response Content:");
                Console.WriteLine(content);
                messages.Add(new Message
                {
                    role = "assistant",
                    content = content
                });

                return Ok(new
                {
                    content = content,
                    messages = messages
                });
            }
            catch (Exception ex)
            {
                var errorMessage = $"Error processing request: {ex.Message}";
                if (ex.InnerException != null)
                {
                    errorMessage += $" Inner exception: {ex.InnerException.Message}";
                }

                return StatusCode(500, errorMessage);
            }
        }
    }
}