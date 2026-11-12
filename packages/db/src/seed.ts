/**
 * Seed dữ liệu demo: cụm "Sinh tồn & bushcraft" + một ít kỹ năng dị.
 *
 * Ghi chú quy tắc: seed là dữ liệu khởi tạo, nên được phép đặt user_skills.level trực tiếp
 * (xem docs/DECISIONS.md). XP vẫn đi qua xp_ledger (ref_type = 'seed') và users.total_xp
 * được tính lại từ sổ cái. Code ứng dụng KHÔNG được làm như vậy — chỉ finalizeProof().
 *
 * Chạy: pnpm db:seed   (SEED_RESET=1 để xóa sạch dữ liệu rồi seed lại — chỉ dùng ở local)
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createPrismaClient, type Prisma } from "./index";

loadEnv({ path: path.resolve(import.meta.dirname, "../../../.env") });

const prisma = createPrismaClient(process.env.DIRECT_URL ?? process.env.DATABASE_URL);

type SkillSeed = {
  slug: string;
  name: string;
  category: string;
  description: string;
  risk?: "none" | "low" | "high";
  holderCount?: number;
  steps: Array<[title: string, task: string, guide: string]>; // 5 mốc: [tên, việc cần làm (để chấm), mô tả hướng dẫn]
};

const CATEGORIES = [
  { slug: "sinh-ton", name: "Sinh tồn" },
  { slug: "ky-nang-di", name: "Kỹ năng dị" },
  { slug: "thu-cong", name: "Thủ công" },
  { slug: "the-chat", name: "Thể chất" },
];

// Mỗi kỹ năng là chuỗi 5 mốc. Mốc N = skill_levels.level N; title = tên mốc, tiêu chí duy nhất = việc cần làm.
// Luật chung (video liên tục, thấy rõ người làm) nằm ở UI dạng ⓘ, không lặp ở từng mốc.
const SKILLS: SkillSeed[] = [
  {
    slug: "sinh-ton-co-ban", name: "Sinh tồn cơ bản", category: "sinh-ton", holderCount: 820,
    description: "Nền tảng sinh tồn ngoài trời: an toàn, định hướng, chuẩn bị.",
    steps: [
      ["Ba lô", "Chuẩn bị ba lô với 10 món thiết yếu", "Bày đủ 10 món lên tấm bạt rồi cho vào ba lô: nước, đồ ăn, dao, đèn, bật lửa, áo mưa, bộ sơ cứu, còi, bản đồ, áo ấm."],
      ["La bàn", "Tìm hướng Bắc bằng la bàn", "Đặt la bàn nằm ngang, chờ kim đứng yên rồi chỉ tay về hướng Bắc. Tránh xa vật kim loại và điện thoại."],
      ["Bóng nắng", "Tìm hướng bằng bóng một cây gậy", "Cắm gậy thẳng, đánh dấu đầu bóng, chờ 15 phút đánh dấu lần nữa. Nối hai điểm là trục Tây–Đông."],
      ["Tín hiệu", "Làm tín hiệu cầu cứu nhìn thấy từ xa", "Xếp đá, cành hoặc vải sáng màu thành chữ SOS lớn trên chỗ trống. Quay từ xa cho thấy rõ cả ký hiệu."],
      ["Một đêm", "Ngủ một đêm ngoài trời an toàn", "Chọn chỗ cao ráo, tránh cây khô và lòng suối. Quay lúc dựng chỗ ngủ, lúc tối và sáng hôm sau."],
    ],
  },
  {
    slug: "nhom-lua", name: "Nhóm lửa", category: "sinh-ton", risk: "low", holderCount: 640,
    description: "Nhóm và giữ lửa bằng nhiều phương pháp.",
    steps: [
      ["Bật lửa", "Nhóm bằng bật lửa, giữ cháy 5 phút", "Chuẩn bị bùi nhùi, que nhỏ, củi to theo ba đống. Nhóm từ nhỏ đến lớn, giữ lửa cháy đều 5 phút."],
      ["Đá lửa", "Nhóm bằng đá lửa, không dùng giấy", "Cạo đá lửa cho tia rơi vào bùi nhùi khô như xơ dừa, vỏ cây. Không dùng giấy, cồn hay viên mồi lửa."],
      ["Trời gió", "Nhóm khi có gió, giữ cháy 5 phút", "Chắn gió bằng thân người, đá hoặc hố nông. Quay rõ lá cây, khói bay để thấy có gió."],
      ["Trời mưa", "Nhóm bằng củi ướt sau mưa", "Chẻ củi ướt lấy lõi khô bên trong, làm phoi bào mỏng. Quay cảnh củi ướt trước khi nhóm."],
      ["Một que diêm", "Một que diêm, thành ngọn dưới 3 phút", "Chỉ dùng đúng một que diêm và vật liệu nhặt tại chỗ. Bấm giờ từ lúc quẹt diêm."],
    ],
  },
  {
    slug: "tim-nguon-nuoc", name: "Tìm nguồn nước", category: "sinh-ton", holderCount: 530,
    description: "Tìm và đánh giá nguồn nước tự nhiên.",
    steps: [
      ["Đọc địa hình", "Chỉ ra 3 nơi có thể có nước", "Tìm thung lũng, chỗ cây xanh rậm, dấu chân thú, đàn côn trùng. Chỉ từng chỗ và nói vì sao."],
      ["Hứng sương", "Thu nước từ sương trên lá buổi sáng", "Lau sương trên cỏ, lá bằng vải sạch lúc sáng sớm rồi vắt vào bình. Quay lượng nước thu được."],
      ["Túi lá", "Trùm túi ni lông lên cành lá để thu nước", "Trùm túi trong lên cành lá còn xanh dưới nắng, buộc kín miệng. Sau vài giờ nước đọng ở góc túi."],
      ["Suối khô", "Đào hố lấy nước ở lòng suối khô", "Đào ở chỗ trũng nhất phía ngoài khúc cua của suối khô. Chờ nước rỉ vào, để lắng cho trong."],
      ["Một lít", "Tìm đủ 1 lít nước trong 2 giờ", "Kết hợp các cách đã học. Đồng hồ bấm giờ phải thấy được trong video, nước cuối cùng đổ vào bình đo."],
    ],
  },
  {
    slug: "dung-trai", name: "Dựng trại", category: "sinh-ton", holderCount: 700,
    description: "Dựng nơi trú ẩn tạm từ vật liệu tại chỗ.",
    steps: [
      ["Lều", "Dựng lều có sẵn dưới 10 phút", "Dùng lều mua sẵn, bấm giờ từ lúc mở túi. Cọc đóng chắc, vải lều căng phẳng."],
      ["Tấm bạt", "Dựng mái che bằng bạt và dây", "Căng dây giữa hai cây, vắt bạt lên, chằng bốn góc xuống đất. Mái phải dốc để thoát nước."],
      ["Không dột", "Đổ nước lên mái che, bên dưới vẫn khô", "Đổ một xô nước lên mái che, quay cận cảnh bên dưới vẫn khô."],
      ["Lều lá", "Dựng lều chữ A từ cành lá tại chỗ", "Dùng một cành dài làm sống lều, dựng cành nhỏ hai bên rồi phủ lá dày từ dưới lên như lợp ngói."],
      ["Qua đêm", "Ngủ qua đêm trong lều tự dựng", "Ngủ trong lều tự dựng từ tối đến sáng. Quay lúc vào lều, giữa đêm và lúc thức dậy."],
    ],
  },
  {
    slug: "lua-bang-que", name: "Lửa bằng que", category: "sinh-ton", risk: "high", holderCount: 214,
    description: "Tạo lửa bằng ma sát que (bow drill / hand drill).",
    steps: [
      ["Ra khói", "Tạo khói bằng que trong 10 phút", "Dùng cung và que khoan, giữ que thẳng đứng, kéo đều tay. Chỉ cần ra khói liên tục."],
      ["Than hồng", "Tạo than hồng, chuyển vào bùi nhùi", "Khoét rãnh chữ V trên tấm đế để bột gỗ dồn lại thành than. Chuyển than vào tổ bùi nhùi, thổi nhẹ."],
      ["Thành ngọn", "Lửa cháy thành ngọn trong 8 phút", "Từ lúc bắt đầu khoan đến khi có ngọn lửa. Đồng hồ bấm giờ phải thấy trong khung hình."],
      ["Dưới 5 phút", "Thành ngọn dưới 5 phút, có nước dập lửa bên cạnh", "Như mốc trước nhưng nhanh hơn. Luôn để sẵn nước dập lửa trong khung hình."],
      ["Tự chế", "Tự làm bộ que từ cây tại chỗ, thành ngọn dưới 5 phút", "Tự làm cung, que và đế từ gỗ nhặt tại chỗ, quay cả lúc làm dụng cụ. Không dùng gỗ mua sẵn."],
    ],
  },
  {
    slug: "loc-nuoc", name: "Lọc nước", category: "sinh-ton", risk: "low", holderCount: 410,
    description: "Lọc và khử khuẩn nước bằng dụng cụ tự chế.",
    steps: [
      ["Lọc vải", "Lọc nước đục qua nhiều lớp vải", "Gấp vải sạch nhiều lớp, đổ nước đục qua. Đặt hai cốc trước và sau cạnh nhau để so."],
      ["Đun sôi", "Đun sôi nước đủ 1 phút", "Đun đến khi sôi sùng sục rồi giữ thêm 1 phút. Đây là cách diệt khuẩn chắc chắn nhất."],
      ["Bình lọc", "Làm bình lọc cát, than, sỏi", "Cắt đáy chai nhựa, xếp từ dưới lên: vải, than, cát mịn, sỏi. Quay từng lớp khi xếp."],
      ["Nước bùn", "Lọc nước bùn thành nước trong", "Dùng bình lọc tự làm với nước bùn thật. Đặt cốc trước và sau cạnh nhau."],
      ["Phơi nắng", "Khử khuẩn bằng chai nhựa phơi nắng 6 giờ", "Đổ nước trong vào chai nhựa trong suốt, phơi nắng gắt 6 giờ. Video tua nhanh có đồng hồ."],
    ],
  },
  {
    slug: "bay-don-gian", name: "Bẫy đơn giản", category: "sinh-ton", risk: "low", holderCount: 300,
    description: "Dựng bẫy đơn giản, thử bằng đồ vật, đúng quy định địa phương.",
    steps: [
      ["Nút trượt", "Thắt nút thòng lọng trượt", "Thắt vòng trượt bằng dây dù, kéo thử để vòng siết lại và nới ra được."],
      ["Cò số 4", "Làm cò bẫy hình số 4 từ que", "Gọt ba que thành chữ số 4 lồng vào nhau. Chạm nhẹ là sập."],
      ["Bẫy hộp", "Dựng bẫy hộp, sập khi chạm cò", "Dùng hộp hoặc rổ chống bằng cò số 4. Thử bằng đồ vật, không dùng con vật thật."],
      ["Ngụy trang", "Ngụy trang bẫy khó nhận ra", "Phủ lá, đất cho bẫy hòa vào xung quanh. Quay toàn cảnh rồi chỉ ra chỗ đặt bẫy."],
      ["Gỡ sạch", "Dựng, kích hoạt rồi gỡ sạch không để lại dấu", "Dựng, kích hoạt rồi tháo bỏ hoàn toàn. Quay chỗ cũ sạch như ban đầu. Chỉ làm nơi được phép."],
    ],
  },
  {
    slug: "song-sot-72-gio", name: "Sống sót 72 giờ", category: "sinh-ton", risk: "high", holderCount: 18,
    description: "Tự lập ngoài trời 72 giờ với bộ đồ tối thiểu.",
    steps: [
      ["6 giờ", "Tự lập ngoài trời 6 giờ, video có mốc giờ", "Chỉ mang dao, bình nước, áo mưa và bộ sơ cứu. Có người biết bạn ở đâu và khi nào về."],
      ["12 giờ", "Tự lập ngoài trời 12 giờ, video có mốc giờ", "Như mốc trước, kéo dài 12 giờ, qua cả lúc trời tối. Quay ngắn mỗi 2 giờ, có đồng hồ."],
      ["24 giờ", "Tự lập ngoài trời 24 giờ, video có mốc giờ", "Một ngày một đêm. Video tóm tắt: chỗ ngủ, lửa, nước, bữa ăn."],
      ["48 giờ", "Tự lập ngoài trời 48 giờ, video có mốc giờ", "Hai ngày hai đêm. Báo vị trí cho người thân mỗi ngày."],
      ["72 giờ", "Tự lập ngoài trời 72 giờ, video có mốc giờ", "Ba ngày ba đêm với bộ đồ tối thiểu. Mỗi ngày quay một đoạn có ngày giờ rõ ràng."],
    ],
  },
  {
    slug: "that-nut-day", name: "Thắt nút dây", category: "sinh-ton", holderCount: 960,
    description: "Các nút dây thông dụng: Bowline, Clove hitch, Figure-8...",
    steps: [
      ["Bowline", "Thắt Bowline trong 30 giây, kéo căng không tuột", "Còn gọi là nút ghế đơn: tạo vòng cố định không siết. Thắt xong kéo căng hai đầu để thấy nút giữ chắc."],
      ["Ba nút", "Bowline, Clove hitch, Figure-8 trong 2 phút", "Thắt lần lượt ba nút, mỗi nút xong giơ lên camera."],
      ["Một tay", "Thắt Bowline bằng một tay trong 20 giây", "Quấn dây quanh eo, chỉ dùng một tay để thắt. Tay kia để yên trong khung hình."],
      ["Tám nút", "Thắt 8 nút khác nhau trong 5 phút", "Tự chọn 8 nút khác nhau, nói tên từng nút khi thắt."],
      ["Bịt mắt", "Thắt Bowline bịt mắt dưới 10 giây", "Bịt mắt kín, bấm giờ từ lúc cầm dây. Quay rõ khăn bịt mắt trước khi bắt đầu."],
    ],
  },
  {
    slug: "so-cuu", name: "Sơ cứu", category: "sinh-ton", risk: "low", holderCount: 1200,
    description: "Sơ cứu vết thương, băng bó, xử lý tình huống cơ bản.",
    steps: [
      ["Rửa vết thương", "Rửa và dán băng vết xước", "Rửa tay, rửa vết xước bằng nước sạch, thấm khô rồi dán băng. Có thể làm trên chính mình."],
      ["Băng tay", "Băng vết thương ở bàn tay", "Đặt gạc lên vết thương, quấn băng cuộn từ cổ tay ra, vừa chặt nhưng không làm tím ngón."],
      ["Nẹp", "Cố định tay gãy bằng nẹp tạm", "Dùng thước, bìa cứng hoặc que làm nẹp, cố định khớp trên và dưới chỗ gãy. Thử trên bạn đồng hành."],
      ["Nằm nghiêng", "Đặt người bất tỉnh nằm nghiêng an toàn", "Kiểm tra thở, đặt người nằm nghiêng, tay đỡ đầu, chân trên co lại. Làm trên bạn đồng hành."],
      ["Ép tim", "Ép tim trên hình nộm, đúng nhịp 30:2", "Chỉ thực hành trên hình nộm. 30 lần ép, 2 lần thổi, nhịp khoảng 100–120 lần mỗi phút."],
    ],
  },
  {
    slug: "huyt-sao-bang-la", name: "Huýt sáo bằng lá", category: "ky-nang-di", holderCount: 41,
    description: "Tạo âm thanh, giai điệu bằng một chiếc lá.",
    steps: [
      ["Ra tiếng", "Thổi lá ra tiếng", "Chọn lá mỏng, mềm như lá chuối non. Kẹp lá giữa môi, thổi mạnh cho lá rung ra tiếng."],
      ["Giữ tiếng", "Giữ tiếng liên tục 5 giây", "Giữ một tiếng đều liên tục ít nhất 5 giây."],
      ["Hai nốt", "Thổi được nốt cao và nốt thấp", "Thay đổi lực thổi và độ căng của lá để có một nốt cao và một nốt thấp rõ ràng."],
      ["Một câu", "Thổi một câu nhạc nghe ra bài gì", "Thổi một câu nhạc quen thuộc. Ghi tên bài ở chú thích để người duyệt dễ nhận ra."],
      ["Trọn bài", "Thổi trọn một bài hát ngắn", "Thổi trọn một bài ngắn từ đầu đến cuối, không dừng giữa chừng."],
    ],
  },
  {
    slug: "viet-chu-nguoc-guong", name: "Viết chữ ngược gương", category: "ky-nang-di", holderCount: 27,
    description: "Viết chữ ngược như phản chiếu trong gương.",
    steps: [
      ["Tên mình", "Viết ngược tên của bạn", "Viết ngược tên bạn trên giấy, sau đó đưa lên gương để thấy chữ xuôi."],
      ["Một câu", "Viết ngược một câu 10 chữ", "Tự chọn một câu khoảng 10 chữ, viết ngược rồi soi gương kiểm tra."],
      ["Một đoạn", "Viết ngược 50 chữ trong 3 phút", "Chép ngược một đoạn khoảng 50 chữ, có đồng hồ bấm giờ trong khung hình."],
      ["Hai tay", "Tay phải viết xuôi, tay trái viết ngược cùng lúc", "Hai tay cùng cầm bút, một tay viết xuôi, một tay viết ngược cùng một câu."],
      ["Bài thơ", "Viết ngược trọn một bài thơ, không nhìn gương", "Viết ngược trọn một bài thơ từ trí nhớ, không nhìn gương khi viết. Soi gương ở cuối video."],
    ],
  },
  {
    slug: "tung-hung", name: "Tung hứng", category: "ky-nang-di", holderCount: 350,
    description: "Tung hứng bóng từ 3 đến 5 quả.",
    steps: [
      ["Hai bóng", "Tung 2 bóng một tay, 20 lần", "Hai bóng trong một tay, tung xoay vòng. Đếm to đủ 20 lần bắt."],
      ["Ba bóng", "Tung 3 bóng, 30 lần liên tục", "Kiểu tung cơ bản, bóng bay hình số 8 nằm. Đếm đủ 30 lần bắt không rơi."],
      ["Một phút", "Tung 3 bóng liên tục 1 phút", "Tung ba bóng liên tục 1 phút, có đồng hồ bấm giờ trong khung hình."],
      ["Bốn bóng", "Tung 4 bóng, 20 lần liên tục", "Bốn bóng, mỗi tay hai bóng. Đếm đủ 20 lần bắt không rơi."],
      ["Năm bóng", "Tung 5 bóng, 10 lần liên tục", "Năm bóng, tung cao và đều. Đếm đủ 10 lần bắt không rơi."],
    ],
  },
  {
    slug: "giai-rubik-bit-mat", name: "Giải rubik bịt mắt", category: "ky-nang-di", holderCount: 64,
    description: "Ghi nhớ và giải khối rubik khi bịt mắt.",
    steps: [
      ["Mở mắt", "Giải rubik 3x3 khi mở mắt", "Xáo khối trước camera rồi giải xong cả sáu mặt."],
      ["Hai phút", "Giải mở mắt dưới 2 phút", "Xáo trước camera, bấm giờ đến khi giải xong."],
      ["Các góc", "Bịt mắt, giải xong các góc", "Nhìn và nhớ khối, bịt mắt rồi giải xong tám góc. Quay khăn bịt mắt rõ ràng."],
      ["Bịt mắt", "Bịt mắt, giải xong cả khối", "Nhớ khối, bịt mắt, giải xong cả khối. Mở mắt cho camera xem kết quả."],
      ["Ba phút", "Bịt mắt, cả nhớ và giải dưới 3 phút", "Bấm giờ từ lúc bắt đầu nhìn khối đến khi giải xong khi bịt mắt."],
    ],
  },
  {
    slug: "mo-khoa-the-thao", name: "Mở khóa thể thao", category: "ky-nang-di", holderCount: 38,
    description: "Mở khóa thể thao trên ổ khóa của chính mình.",
    steps: [
      ["Ổ trong suốt", "Mở ổ khóa tập trong suốt", "Dùng bộ ổ khóa tập trong suốt và bộ cây mở. Chỉ mở ổ khóa của chính bạn."],
      ["Ổ thường", "Mở ổ khóa móc thường của bạn", "Mở một ổ khóa móc của bạn. Quay chìa khóa của ổ để chứng minh là ổ của bạn."],
      ["Một phút", "Mở ổ khóa thường dưới 1 phút", "Như mốc trước, có đồng hồ bấm giờ trong khung hình."],
      ["Chốt chống mở", "Mở ổ có chốt chống mở", "Ổ có chốt chống mở khó hơn, cần cảm nhận chốt kỹ."],
      ["Không nhìn", "Mở ổ mà không nhìn vào ổ", "Mở trong lúc mắt nhìn ra chỗ khác hoặc ổ được che. Chỉ mở ổ khóa của chính bạn."],
    ],
  },
  {
    slug: "thoi-thuy-tinh", name: "Thổi thủy tinh", category: "thu-cong", risk: "high", holderCount: 12,
    description: "Tạo hình thủy tinh nóng chảy.",
    steps: [
      ["Hạt", "Tạo một hạt thủy tinh tròn", "Chỉ làm tại xưởng có người hướng dẫn và đồ bảo hộ. Nung đầu que thủy tinh, quấn quanh trục thành hạt tròn."],
      ["Que xoắn", "Kéo một que thủy tinh xoắn", "Nung hai màu, vừa xoay vừa kéo thành que xoắn đều."],
      ["Bong bóng", "Thổi một bong bóng thủy tinh nhỏ", "Thổi qua ống cho thủy tinh nóng phồng thành bong bóng tròn, thành đều."],
      ["Cốc", "Thổi một chiếc cốc nhỏ", "Thổi rồi tạo đáy và miệng cốc, cốc đứng vững trên bàn."],
      ["Bình", "Thổi một chiếc bình có quai", "Thổi thân bình rồi gắn quai. Quay cả lúc gắn quai."],
    ],
  },
  {
    slug: "ben-day-paracord", name: "Bện dây paracord", category: "thu-cong", holderCount: 520,
    description: "Bện vòng tay, dây đeo từ paracord.",
    steps: [
      ["Vòng rắn", "Bện vòng tay kiểu rắn hổ mang", "Kiểu bện cơ bản cho người mới. Chuẩn bị khoảng 3 mét dây và một khóa nhựa."],
      ["Móc khóa", "Bện dây móc chìa khóa", "Bện một dây móc chìa khóa có vòng treo, đầu dây khò gọn."],
      ["Xương cá", "Bện vòng tay kiểu xương cá", "Bện vòng tay kiểu xương cá, các mắt bện đều nhau."],
      ["Hai màu", "Bện vòng tay hai màu có khóa", "Dùng hai dây khác màu, có khóa nhựa. Thành phẩm đeo vừa tay."],
      ["Dây nịt", "Bện dây nịt dài 1 mét", "Bện dây nịt dài 1 mét, đặt thước cạnh thành phẩm."],
    ],
  },
  {
    slug: "dan-len", name: "Đan len", category: "thu-cong", holderCount: 900,
    description: "Đan khăn, mũ và họa tiết len.",
    steps: [
      ["Mũi lên", "Đan 10 hàng mũi lên đều tay", "Bắt mũi rồi đan 10 hàng mũi lên. Các mũi đều tay, không lỏng chặt khác nhau."],
      ["Khăn ngắn", "Đan một khăn dài 30 cm", "Đan một khăn ngắn dài khoảng 30 cm, đặt thước cạnh thành phẩm."],
      ["Vặn thừng", "Đan họa tiết vặn thừng", "Dùng kim phụ bắt chéo mũi để tạo họa tiết vặn thừng nổi."],
      ["Mũ len", "Đan một chiếc mũ len", "Đan mũ vòng tròn, thu đầu gọn. Đội thử ở cuối video."],
      ["Hai màu", "Đan họa tiết hai màu", "Đan họa tiết với hai màu len, mặt trái gọn gàng."],
    ],
  },
  {
    slug: "leo-nui", name: "Leo núi", category: "the-chat", risk: "high", holderCount: 150,
    description: "Leo vách tự nhiên và nhân tạo an toàn.",
    steps: [
      ["Tuyến dễ", "Leo hết một tuyến dễ ở phòng tập, có dây", "Leo tại phòng tập, có dây an toàn và người giữ dây. Leo đến đỉnh tuyến dễ nhất."],
      ["Nút số 8", "Thắt nút số 8 và kiểm tra chéo với bạn leo", "Thắt nút số 8 vào đai, sau đó bạn leo kiểm tra lại cho bạn và ngược lại."],
      ["Tuyến khó", "Leo hết tuyến độ khó 5c", "Leo tuyến độ khó 5c từ đầu đến đỉnh, không nghỉ trên dây."],
      ["Đá thật", "Leo vách đá tự nhiên, có người bảo hộ", "Leo vách đá thật, có người bảo hộ và đủ đồ an toàn. Quay cả lúc kiểm tra đồ."],
      ["Dẫn dây", "Leo dẫn dây hết một tuyến", "Leo dẫn dây, tự móc dây vào từng điểm neo. Chỉ làm khi đã được hướng dẫn."],
    ],
  },
];

const stepTitle = (slug: string, level: number) => SKILLS.find((x) => x.slug === slug)!.steps[level - 1]![0];

const EDGES: Array<[string, string, number]> = [
  ["sinh-ton-co-ban", "nhom-lua", 1],
  ["sinh-ton-co-ban", "tim-nguon-nuoc", 1],
  ["sinh-ton-co-ban", "dung-trai", 1],
  ["nhom-lua", "lua-bang-que", 2],
  ["tim-nguon-nuoc", "loc-nuoc", 2],
  ["dung-trai", "bay-don-gian", 2],
  ["lua-bang-que", "song-sot-72-gio", 3],
  ["loc-nuoc", "song-sot-72-gio", 3],
  ["bay-don-gian", "song-sot-72-gio", 3],
];

const USERS = [
  { handle: "minhhoang", displayName: "Minh Hoàng", email: "minhhoang@demo.skillverse.local", reputation: 82, isEditor: false },
  { handle: "quocbao", displayName: "Quốc Bảo", email: "quocbao@demo.skillverse.local", reputation: 74 },
  { handle: "thuha", displayName: "Thu Hà", email: "thuha@demo.skillverse.local", reputation: 68 },
  { handle: "lanphuong", displayName: "Lan Phương", email: "lanphuong@demo.skillverse.local", reputation: 60 },
  { handle: "bientap", displayName: "Biên tập viên", email: "editor@demo.skillverse.local", reputation: 95, isEditor: true },
  { handle: "ducanh", displayName: "Đức Anh", email: "ducanh@demo.skillverse.local", reputation: 70 },
  { handle: "maianh", displayName: "Mai Anh", email: "maianh@demo.skillverse.local", reputation: 66 },
  { handle: "tuankiet", displayName: "Tuấn Kiệt", email: "tuankiet@demo.skillverse.local", reputation: 58 },
  { handle: "ngoclan", displayName: "Ngọc Lan", email: "ngoclan@demo.skillverse.local", reputation: 55 },
  { handle: "hoangnam", displayName: "Hoàng Nam", email: "hoangnam@demo.skillverse.local", reputation: 35 },
  // Người dùng mới (chưa onboarding) — dùng cho e2e
  { handle: "nguoimoi", displayName: "Người Mới", email: "nguoimoi@demo.skillverse.local", reputation: 50, fresh: true },
] as Array<{ handle: string; displayName: string; email: string; reputation: number; isEditor?: boolean; fresh?: boolean }>;

// [handle, skillSlug, level]
const USER_SKILLS: Array<[string, string, number]> = [
  ["minhhoang", "sinh-ton-co-ban", 5], ["minhhoang", "nhom-lua", 4], ["minhhoang", "lua-bang-que", 3],
  ["minhhoang", "tim-nguon-nuoc", 2], ["minhhoang", "loc-nuoc", 1], ["minhhoang", "mo-khoa-the-thao", 3],
  ["minhhoang", "tung-hung", 4], ["minhhoang", "that-nut-day", 3],
  ["quocbao", "ben-day-paracord", 4], ["quocbao", "that-nut-day", 5], ["quocbao", "sinh-ton-co-ban", 3], ["quocbao", "lua-bang-que", 5],
  ["thuha", "viet-chu-nguoc-guong", 5], ["thuha", "that-nut-day", 4], ["thuha", "huyt-sao-bang-la", 2], ["thuha", "lua-bang-que", 5],
  ["lanphuong", "tung-hung", 3], ["lanphuong", "dan-len", 4],
  ["bientap", "sinh-ton-co-ban", 5], ["bientap", "so-cuu", 5], ["bientap", "that-nut-day", 5], ["bientap", "lua-bang-que", 5],
  ["ducanh", "that-nut-day", 4], ["ducanh", "tung-hung", 5], ["ducanh", "lua-bang-que", 5], ["ducanh", "nhom-lua", 3],
  ["maianh", "that-nut-day", 3], ["maianh", "tung-hung", 4], ["maianh", "lua-bang-que", 5], ["maianh", "dan-len", 2],
  ["tuankiet", "that-nut-day", 2], ["tuankiet", "tung-hung", 5], ["tuankiet", "lua-bang-que", 4], ["tuankiet", "leo-nui", 3],
  ["ngoclan", "that-nut-day", 2], ["ngoclan", "so-cuu", 3], ["ngoclan", "tung-hung", 3],
  ["hoangnam", "that-nut-day", 3], ["hoangnam", "tung-hung", 2],
];

const BADGES = [
  { slug: "first-proof", name: "Bằng chứng đầu tiên", description: "Có bằng chứng đầu tiên được cộng đồng xác thực." },
  { slug: "max-level", name: "Đỉnh cao", description: "Đạt cấp cao nhất của một kỹ năng." },
  { slug: "rare-holder", name: "Người hiếm có", description: "Đạt cấp cao nhất của một kỹ năng Hiếm." },
  { slug: "legendary-holder", name: "Huyền thoại", description: "Đạt cấp cao nhất của một kỹ năng Huyền thoại." },
  { slug: "reviewer-10", name: "Người duyệt tận tâm", description: "Hoàn thành 10 lượt duyệt." },
  { slug: "proposal-accepted", name: "Người góp ý", description: "Có đề xuất được cộng đồng thông qua." },
];

function accountLevelForXp(totalXp: number, step: number): number {
  // XP để từ cấp L lên L+1 = step * L  (app_config.account_level_curve)
  let level = 1;
  let remaining = totalXp;
  while (remaining >= step * level) {
    remaining -= step * level;
    level += 1;
  }
  return level;
}


async function reset() {
  // Thứ tự xóa theo khóa ngoại. Chỉ dùng ở local.
  const tables = [
    "auth_sessions", "auth_accounts", "auth_verification_tokens",
    "duel_votes", "duels", "challenge_entries", "challenges", "swap_ratings", "skill_swaps",
    "messages", "message_threads", "notifications", "daily_quests", "reactions", "comments", "posts",
    "proposal_votes", "proposal_comments", "sanctions", "reports", "fraud_signals", "device_fingerprints",
    "review_marks", "reviews", "review_assignments", "appeals", "user_badges", "xp_ledger", "reputation_events",
    "skill_follows", "follows",
  ];
  for (const t of tables) await prisma.$executeRawUnsafe(`DELETE FROM ${t}`);
  await prisma.$executeRawUnsafe(`UPDATE user_skills SET last_proof_id = NULL`);
  await prisma.$executeRawUnsafe(`DELETE FROM proofs`);
  await prisma.$executeRawUnsafe(`DELETE FROM user_skills`);
  await prisma.$executeRawUnsafe(`UPDATE skill_levels SET current_version_id = NULL`);
  await prisma.$executeRawUnsafe(`UPDATE criteria_versions SET source_proposal_id = NULL`);
  await prisma.$executeRawUnsafe(`DELETE FROM proposals`);
  await prisma.$executeRawUnsafe(`DELETE FROM criteria`);
  await prisma.$executeRawUnsafe(`DELETE FROM criteria_versions`);
  await prisma.$executeRawUnsafe(`DELETE FROM skill_levels`);
  await prisma.$executeRawUnsafe(`DELETE FROM skill_edges`);
  await prisma.$executeRawUnsafe(`DELETE FROM skills`);
  await prisma.$executeRawUnsafe(`DELETE FROM categories`);
  await prisma.$executeRawUnsafe(`DELETE FROM badges`);
  await prisma.$executeRawUnsafe(`DELETE FROM users`);
}

async function main() {
  if (process.env.SEED_RESET === "1") {
    console.log("SEED_RESET=1 → xóa dữ liệu cũ");
    await reset();
  }
  if ((await prisma.skill.count()) > 0) {
    console.log("Đã có dữ liệu, bỏ qua seed (SEED_RESET=1 để seed lại).");
    return;
  }

  const curve = await prisma.appConfig.findUniqueOrThrow({ where: { key: "account_level_curve" } });
  const step = (curve.value as { step: number }).step;

  const cats = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.category.create({ data: c });
    cats.set(c.slug, row.id);
  }

  const skills = new Map<string, { id: string; levels: Map<number, { levelId: string; criteriaIds: string[]; versionId: string }> }>();
  for (const s of SKILLS) {
    const skill = await prisma.skill.create({
      data: {
        slug: s.slug,
        name: s.name,
        categoryId: cats.get(s.category)!,
        description: s.description,
        riskLevel: s.risk ?? "none",
        status: "active",
        maxLevel: 5,
        holderCount: s.holderCount ?? 0,
      },
    });
    const levels = new Map<number, { levelId: string; criteriaIds: string[]; versionId: string }>();
    for (let lv = 1; lv <= 5; lv++) {
      const sl = await prisma.skillLevel.create({
        data: {
          skillId: skill.id,
          level: lv,
          title: s.steps[lv - 1]![0],
          description: s.steps[lv - 1]![2],
          xpReward: 100 * lv,
          minReviewers: 3,
          minReviewerLevel: Math.max(1, lv - 1),
        },
      });
      const version = await prisma.criteriaVersion.create({
        data: {
          skillLevelId: sl.id,
          version: 1,
          criteria: {
            create: [{ position: 1, text: s.steps[lv - 1]![1], kind: "checklist" as const }],
          },
        },
        include: { criteria: true },
      });
      await prisma.skillLevel.update({ where: { id: sl.id }, data: { currentVersionId: version.id } });
      levels.set(lv, { levelId: sl.id, versionId: version.id, criteriaIds: version.criteria.map((c) => c.id) });
    }
    skills.set(s.slug, { id: skill.id, levels });
  }

  for (const [p, c, req] of EDGES) {
    await prisma.skillEdge.create({
      data: { parentSkillId: skills.get(p)!.id, childSkillId: skills.get(c)!.id, requiredLevel: req },
    });
  }

  for (const b of BADGES) await prisma.badge.create({ data: b });

  const users = new Map<string, string>();
  const now = Date.now();
  for (const [i, u] of USERS.entries()) {
    const row = await prisma.user.create({
      data: {
        handle: u.handle,
        displayName: u.displayName,
        email: u.email,
        emailVerified: new Date(),
        reputation: u.reputation,
        isEditor: u.isEditor ?? false,
        onboardedAt: u.fresh ? null : new Date(now - (30 - i) * 86400000),
        createdAt: new Date(now - (60 - i) * 86400000),
      },
    });
    users.set(u.handle, row.id);
    if (u.reputation !== 50) {
      await prisma.reputationEvent.create({
        data: { userId: row.id, delta: u.reputation - 50, reason: "seed" },
      });
    }
  }

  // user_skills + xp_ledger (ref_type = 'seed')
  const xpByUser = new Map<string, number>();
  for (const [handle, slug, level] of USER_SKILLS) {
    const userId = users.get(handle)!;
    const skillId = skills.get(slug)!.id;
    let xp = 0;
    for (let lv = 1; lv <= level; lv++) xp += 100 * lv;
    await prisma.userSkill.create({ data: { userId, skillId, level, xp } });
    await prisma.xpLedger.create({
      data: { userId, skillId, amount: xp, reason: "proof_passed", refType: "seed" },
    });
    xpByUser.set(userId, (xpByUser.get(userId) ?? 0) + xp);
  }
  // Thêm XP duyệt cho người dùng chính để cấp tài khoản giống mockup hơn
  const bonus: Array<[string, number]> = [["minhhoang", 22000], ["quocbao", 3000], ["thuha", 12000]];
  for (const [h, amount] of bonus) {
    const userId = users.get(h)!;
    await prisma.xpLedger.create({ data: { userId, amount, reason: "review_done", refType: "seed" } });
    xpByUser.set(userId, (xpByUser.get(userId) ?? 0) + amount);
  }
  for (const [userId, total] of xpByUser) {
    await prisma.user.update({
      where: { id: userId },
      data: { totalXp: total, accountLevel: accountLevelForXp(total, step) },
    });
  }

  // Quan hệ xã hội
  const follow = (a: string, b: string) =>
    prisma.follow.create({ data: { followerId: users.get(a)!, followeeId: users.get(b)! } });
  await follow("minhhoang", "quocbao");
  await follow("minhhoang", "thuha");
  await follow("quocbao", "minhhoang");
  await follow("lanphuong", "thuha");
  for (const slug of ["lua-bang-que", "that-nut-day", "tung-hung"]) {
    await prisma.skillFollow.create({ data: { userId: users.get("minhhoang")!, skillId: skills.get(slug)!.id } });
  }

  // Bằng chứng đã đạt (để có bài lên cấp trên feed) — media là placeholder.
  const passedProof = async (handle: string, slug: string, level: number, caption: string, hoursAgo: number) => {
    const s = skills.get(slug)!;
    const lv = s.levels.get(level)!;
    const proof = await prisma.proof.create({
      data: {
        userId: users.get(handle)!,
        skillId: s.id,
        targetLevel: level,
        criteriaVersionId: lv.versionId,
        mediaUrl: `seed/${slug}-${level}.mp4`,
        mediaHash: `seed-${handle}-${slug}-${level}`,
        durationS: 64,
        caption,
        safetyAck: true,
        status: "passed",
        decidedAt: new Date(now - hoursAgo * 3600000),
        createdAt: new Date(now - (hoursAgo + 20) * 3600000),
      },
    });
    await prisma.post.create({
      data: {
        authorId: users.get(handle)!,
        kind: "level_up",
        proofId: proof.id,
        skillId: s.id,
        body: `${SKILLS.find((x) => x.slug === slug)!.name}: xong mốc ${stepTitle(slug, level)}`,
        // like_count / comment_count là cache: đặt 0 rồi tạo dòng thật ở reactPost bên dưới
        createdAt: new Date(now - hoursAgo * 3600000),
      },
    });
    return proof;
  };
  await passedProof("quocbao", "ben-day-paracord", 4, "Vòng hai màu có khóa, bện xong trong 40 phút.", 0.25);
  await passedProof("thuha", "viet-chu-nguoc-guong", 5, "Chép nguyên bài thơ lục bát bằng tay trái, ngược gương.", 1);
  await prisma.post.create({
    data: {
      authorId: users.get("thuha")!,
      kind: "text",
      skillId: skills.get("viet-chu-nguoc-guong")!.id,
      body: "Chép nguyên bài thơ lục bát bằng tay trái, ngược gương. Mất 3 tháng luyện mới viết đều được như vậy.",
      createdAt: new Date(now - 3600000),
    },
  });

  // Cảm xúc + bình luận thật để cache like_count/comment_count khớp bảng reactions/comments.
  const handles = USERS.filter((u) => !u.fresh).map((u) => u.handle);
  const allPosts = await prisma.post.findMany({ select: { id: true, authorId: true } });
  for (const [i, post] of allPosts.entries()) {
    const fans = handles.map((h) => users.get(h)!).filter((id) => id !== post.authorId).slice(0, 3 + ((i * 3) % 6));
    for (const [j, userId] of fans.entries()) {
      await prisma.reaction.create({ data: { postId: post.id, userId, kind: j % 3 === 0 ? "cheer" : "like" } });
    }
    const commenters = fans.slice(0, 1 + (i % 3));
    for (const userId of commenters) {
      await prisma.comment.create({ data: { postId: post.id, userId, body: "Đỉnh quá, mình cũng đang luyện kỹ năng này." } });
    }
    await prisma.post.update({ where: { id: post.id }, data: { likeCount: fans.length, commentCount: commenters.length } });
  }

  // Bằng chứng đang chờ duyệt (Lan Phương, tung hứng cấp 4) — chưa phân công; domain/cron sẽ gán.
  const th = skills.get("tung-hung")!;
  await prisma.proof.create({
    data: {
      userId: users.get("lanphuong")!,
      skillId: th.id,
      targetLevel: 4,
      criteriaVersionId: th.levels.get(4)!.versionId,
      mediaUrl: "seed/tung-hung-4.mp4",
      mediaHash: "seed-lanphuong-tung-hung-4",
      durationS: 64,
      caption: "Bốn bóng, 20 lần liên tục",
      safetyAck: true,
      status: "pending",
      createdAt: new Date(now - 2 * 3600000),
    },
  });

  // Thử thách tuần
  await prisma.challenge.create({
    data: {
      title: "Nhóm lửa trong mưa",
      skillId: skills.get("nhom-lua")!.id,
      criteria: {
        description: "Giữ ngọn lửa cháy 3 phút trong điều kiện ẩm ướt. Không dùng bật lửa.",
        items: ["Lửa cháy liên tục 3 phút", "Điều kiện ẩm ướt thấy rõ trong video", "Không dùng bật lửa, diêm"],
      },
      startsAt: new Date(now - 4 * 86400000),
      endsAt: new Date(now + 3 * 86400000),
      xpReward: 600,
    },
  });

  // Đấu 1v1
  const tn = skills.get("that-nut-day")!;
  const duelProof = async (handle: string, seconds: number) =>
    prisma.proof.create({
      data: {
        userId: users.get(handle)!,
        skillId: tn.id,
        targetLevel: 5,
        criteriaVersionId: tn.levels.get(5)!.versionId,
        mediaUrl: `seed/duel-${handle}.mp4`,
        mediaHash: `seed-duel-${handle}`,
        durationS: Math.ceil(seconds),
        caption: `Bowline ${seconds.toString().replace(".", ",")}s`,
        safetyAck: true,
        status: "passed",
        decidedAt: new Date(now - 86400000),
        createdAt: new Date(now - 2 * 86400000),
      },
    });
  const pa = await duelProof("quocbao", 7.4);
  const pb = await duelProof("thuha", 8.1);
  const endOfDay = new Date();
  endOfDay.setHours(20, 0, 0, 0);
  if (endOfDay.getTime() < now) endOfDay.setDate(endOfDay.getDate() + 1);
  await prisma.duel.create({
    data: {
      skillId: tn.id,
      metric: "Thời gian thắt nút Bowline (giây)",
      userA: users.get("quocbao")!,
      userB: users.get("thuha")!,
      proofA: pa.id,
      proofB: pb.id,
      voteEndsAt: endOfDay,
    },
  });

  // Đề xuất sửa tiêu chí (Lửa bằng que cấp 4)
  const lbq = skills.get("lua-bang-que")!;
  const proposal = await prisma.proposal.create({
    data: {
      kind: "edit_criteria",
      authorId: users.get("quocbao")!,
      skillId: lbq.id,
      skillLevelId: lbq.levels.get(4)!.levelId,
      payload: {
        criteria: [
          { text: "Thành ngọn dưới 5 phút, có nước dập lửa bên cạnh, gỗ tự kiếm tại chỗ", kind: "checklist" },
        ],
        summary: "Mốc Dưới 5 phút: gỗ phải tự kiếm tại chỗ",
      } satisfies Prisma.InputJsonValue,
      rationale: "Gỗ mua sẵn đã được sấy khô, làm bài kiểm tra dễ hơn nhiều so với thực tế.",
      status: "voting",
      votingEndsAt: new Date(now + 10 * 86400000),
    },
  });
  const voters: Array<[string, "agree" | "disagree"]> = [
    ["thuha", "agree"], ["bientap", "agree"], ["ducanh", "agree"], ["maianh", "disagree"], ["lanphuong", "agree"],
  ];
  for (const [h, vote] of voters) {
    const us = USER_SKILLS.find(([uh, sl]) => uh === h && sl === "lua-bang-que");
    await prisma.proposalVote.create({
      data: { proposalId: proposal.id, userId: users.get(h)!, vote, weight: us && us[2] >= 5 ? 1 : 0 },
    });
  }

  // Đề xuất kỹ năng mới đang thu thập ủng hộ
  await prisma.proposal.create({
    data: {
      kind: "new_skill",
      authorId: users.get("thuha")!,
      payload: {
        name: "Gấp giấy origami 1 tờ",
        categorySlug: "thu-cong",
        description: "Gấp mô hình phức tạp từ một tờ giấy, không cắt, không dán.",
        riskLevel: "none",
        levels: [
          ["Con hạc", "Gấp con hạc giấy", "Mẫu kinh điển cho người mới, từ một tờ giấy vuông."],
          ["Ếch nhảy", "Gấp con ếch bật nhảy được", "Ấn nhẹ lưng ếch cho nó bật lên trong video."],
          ["Hoa sen", "Gấp bông hoa sen", "Gấp nhiều lớp cánh rồi lộn ra, cánh đều nhau."],
          ["Con rồng", "Gấp con rồng có cánh", "Mẫu nhiều nếp gấp, cần giấy mỏng khổ lớn."],
          ["Bọ cánh cứng", "Gấp bọ cánh cứng đủ 6 chân", "Mẫu khó, đếm đủ chân và râu ở cuối video."],
        ].map(([title, text, description], i) => ({ level: i + 1, title, description, criteria: [{ text, kind: "checklist" }] })),
      } satisfies Prisma.InputJsonValue,
      rationale: "Kỹ năng phổ biến, dễ xác thực bằng video.",
      status: "gathering",
      supportCount: 1,
      votingEndsAt: new Date(now + 14 * 86400000),
    },
  });

  console.log(
    `Seed xong: ${SKILLS.length} kỹ năng, ${USERS.length} người dùng. Đăng nhập dev bằng handle, vd. "minhhoang", "bientap", "nguoimoi".`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
