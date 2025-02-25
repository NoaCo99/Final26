namespace Prog3_WebApi_Javascript.DTOs
{
    public class Prompt
    {
        public string Question { get; set; }
        public string Data { get; set; }
        public List<Message> ChatHistory { get; set; } = new List<Message>();
    }

}